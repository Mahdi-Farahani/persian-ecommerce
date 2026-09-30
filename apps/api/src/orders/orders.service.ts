import { Injectable, Logger } from '@nestjs/common';
import {
  buildPagination,
  type AdminOrderDetail,
  type AdminOrderSummary,
  type OrderDetail,
  type OrderSummary,
  type Paginated,
} from '@pe/shared';
import { CartService } from '../cart/cart.service.js';
import { CheckoutService } from '../checkout/checkout.service.js';
import {
  ForbiddenAppException,
  NotFoundAppException,
  UnprocessableAppException,
} from '../common/errors/app.exception.js';
import { AppConfigService } from '../config/app-config.service.js';
import type { OrderStatus, Prisma } from '../generated/prisma/client.js';
import { InventoryService, type ReservationLine } from '../inventory/inventory.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminOrdersQueryDto, CreateShipmentDto, PlaceOrderDto } from './dto/order.dto.js';
import {
  ADMIN_SETTABLE_STATUSES,
  canTransition,
  ORDER_STATUS_LABELS,
  RESERVED_STATUSES,
  SOLD_STATUSES,
} from './order-status.js';
import {
  orderDetailInclude,
  orderSummaryInclude,
  toAdminOrderDetail,
  toAdminOrderSummary,
  toOrderDetail,
  toOrderSummary,
  type OrderDetailRow,
} from './orders.mapper.js';

type Tx = Prisma.TransactionClient;
const MINUTE_MS = 60_000;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly checkout: CheckoutService,
    private readonly inventory: InventoryService,
    private readonly config: AppConfigService,
  ) {}

  /**
   * Places an order from the user's cart. Runs as one transaction:
   * re-quote → lock & reserve stock → snapshot items → convert cart → count
   * coupon usage. Payment is initiated separately (an order may have several
   * payment attempts).
   */
  async placeOrder(userId: string, dto: PlaceOrderDto): Promise<OrderDetail> {
    const quote = await this.checkout.quote({
      userId,
      addressId: dto.addressId,
      shippingMethodCode: dto.shippingMethodCode,
    });
    if (!quote.canPlaceOrder) {
      throw new UnprocessableAppException('CHECKOUT_BLOCKED', 'سبد خرید شما نیاز به بازبینی دارد', {
        issues: quote.issues,
      });
    }
    const lines: ReservationLine[] = quote.cart.items.map((i) => ({
      variantId: i.variantId,
      quantity: i.quantity,
    }));
    const deadline = new Date(Date.now() + this.config.orders.paymentTimeoutMinutes * MINUTE_MS);

    const orderId = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId,
          status: 'PENDING_PAYMENT',
          subtotal: BigInt(quote.totals.subtotal),
          discount: BigInt(quote.totals.discount),
          shippingFee: BigInt(quote.totals.shippingFee),
          total: BigInt(quote.totals.grandTotal),
          couponCode: quote.cart.coupon?.code ?? null,
          couponId: quote.cart.coupon
            ? (
                await tx.coupon.findUnique({
                  where: { code: quote.cart.coupon.code },
                  select: { id: true },
                })
              )?.id
            : null,
          shippingMethodCode: quote.shippingMethod.code,
          shippingMethodName: quote.shippingMethod.name,
          estimatedDaysMin: quote.shippingMethod.estimatedDaysMin,
          estimatedDaysMax: quote.shippingMethod.estimatedDaysMax,
          recipientName: quote.address.recipientName,
          recipientPhone: quote.address.recipientPhone,
          province: quote.address.province,
          city: quote.address.city,
          addressLine: quote.address.addressLine,
          postalCode: quote.address.postalCode,
          customerNote: dto.note ?? null,
          paymentDeadlineAt: deadline,
          items: {
            create: quote.cart.items.map((item) => ({
              variantId: item.variantId,
              productId: item.productId,
              productTitle: item.productTitle,
              productSlug: item.productSlug,
              variantTitle: item.variantTitle,
              sku: item.sku,
              imageUrl: item.image?.url ?? null,
              unitPrice: BigInt(item.unitPrice),
              compareAtPrice: item.compareAtPrice === null ? null : BigInt(item.compareAtPrice),
              quantity: item.quantity,
              lineTotal: BigInt(item.lineTotal),
            })),
          },
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: 'PENDING_PAYMENT',
              note: 'ثبت سفارش',
              actorId: userId,
            },
          },
        },
        select: { id: true },
      });
      // Throws InsufficientStockError (rolls back) when a concurrent checkout won.
      await this.inventory.reserve(tx, lines, {
        referenceType: 'order',
        referenceId: order.id,
        actorId: userId,
      });
      if (quote.cart.coupon) {
        await tx.coupon.update({
          where: { code: quote.cart.coupon.code },
          data: { usedCount: { increment: 1 } },
        });
      }
      await this.cart.markConverted(quote.cart.id, tx);
      return order.id;
    });
    this.logger.log({ message: 'order placed', orderId, userId, total: quote.totals.grandTotal });
    return this.getForUser(userId, orderId);
  }

  async listForUser(userId: string, page: number, limit: number): Promise<Paginated<OrderSummary>> {
    const where: Prisma.OrderWhereInput = { userId };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: orderSummaryInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { items: rows.map(toOrderSummary), pagination: buildPagination(page, limit, total) };
  }

  async getForUser(userId: string, orderId: string): Promise<OrderDetail> {
    const row = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: orderDetailInclude,
    });
    if (!row) throw new NotFoundAppException('ORDER_NOT_FOUND', 'سفارش پیدا نشد');
    return toOrderDetail(row);
  }

  /** Customer-initiated cancellation of an unpaid order (releases the reservation). */
  async cancelByCustomer(userId: string, orderId: string): Promise<OrderDetail> {
    const row = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: true },
    });
    if (!row) throw new NotFoundAppException('ORDER_NOT_FOUND', 'سفارش پیدا نشد');
    if (row.status !== 'PENDING_PAYMENT') {
      throw new ForbiddenAppException(
        'ORDER_NOT_CANCELLABLE',
        'این سفارش در این مرحله قابل لغو نیست',
      );
    }
    await this.prisma.$transaction((tx) =>
      this.transition(tx, row.id, row.status, 'CANCELLED', 'لغو توسط مشتری', userId),
    );
    return this.getForUser(userId, orderId);
  }

  /**
   * Transitions an order and applies the inventory side effects:
   * PENDING_PAYMENT → PAID commits the sale, → CANCELLED releases the
   * reservation (or restocks sold units), → RETURNED restocks.
   */
  async transition(
    tx: Tx,
    orderId: string,
    from: OrderStatus,
    to: OrderStatus,
    note: string | null,
    actorId: string | null,
  ): Promise<void> {
    if (!canTransition(from, to)) {
      throw new UnprocessableAppException(
        'ORDER_TRANSITION_INVALID',
        `تغییر وضعیت از «${ORDER_STATUS_LABELS[from]}» به «${ORDER_STATUS_LABELS[to]}» مجاز نیست`,
      );
    }
    const items = await tx.orderItem.findMany({
      where: { orderId, variantId: { not: null } },
      select: { variantId: true, quantity: true },
    });
    const lines: ReservationLine[] = items.map((i) => ({
      variantId: i.variantId!,
      quantity: i.quantity,
    }));
    const ref = { referenceType: 'order', referenceId: orderId, actorId: actorId ?? undefined };

    if (to === 'PAID' && RESERVED_STATUSES.includes(from)) {
      await this.inventory.commitSale(tx, lines, ref);
    } else if (to === 'CANCELLED') {
      if (RESERVED_STATUSES.includes(from)) await this.inventory.release(tx, lines, ref);
      else if (SOLD_STATUSES.includes(from))
        await this.inventory.returnStock(tx, lines, { ...ref, note: 'لغو پس از پرداخت' });
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        select: { couponId: true },
      });
      if (order.couponId)
        await tx.coupon.update({
          where: { id: order.couponId },
          data: { usedCount: { decrement: 1 } },
        });
    } else if (to === 'RETURNED' && from === 'RETURN_REQUESTED') {
      await this.inventory.returnStock(tx, lines, { ...ref, note: 'مرجوعی' });
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: to,
        paidAt: to === 'PAID' ? new Date() : undefined,
        cancelledAt: to === 'CANCELLED' ? new Date() : undefined,
        cancelReason: to === 'CANCELLED' ? note : undefined,
        statusHistory: { create: { fromStatus: from, toStatus: to, note, actorId } },
      },
    });
  }

  /** Cancels unpaid orders whose payment deadline passed. Returns the count. */
  async expireUnpaid(now = new Date()): Promise<number> {
    const expired = await this.prisma.order.findMany({
      where: { status: 'PENDING_PAYMENT', paymentDeadlineAt: { lt: now } },
      select: { id: true },
      take: 100,
    });
    let count = 0;
    for (const { id } of expired) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // Re-check inside the transaction: a late payment may have completed.
          const fresh = await tx.order.findUnique({ where: { id }, select: { status: true } });
          if (fresh?.status !== 'PENDING_PAYMENT') return;
          await this.transition(
            tx,
            id,
            'PENDING_PAYMENT',
            'CANCELLED',
            'مهلت پرداخت به پایان رسید',
            null,
          );
          await tx.payment.updateMany({
            where: { orderId: id, status: { in: ['INITIATED', 'REDIRECTED'] } },
            data: { status: 'EXPIRED' },
          });
          count += 1;
        });
      } catch (error) {
        this.logger.error(`Failed to expire order ${id}: ${(error as Error).message}`);
      }
    }
    if (count > 0) this.logger.log({ message: 'expired unpaid orders', count });
    return count;
  }

  // --- administration -------------------------------------------------------

  async adminList(query: AdminOrdersQueryDto): Promise<Paginated<AdminOrderSummary>> {
    const where: Prisma.OrderWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.userId) where.userId = query.userId;
    if (query.search) {
      const numeric = Number(query.search.replace(/^PE-?/i, ''));
      where.OR = [
        ...(Number.isInteger(numeric) && numeric > 0 ? [{ number: numeric }] : []),
        { user: { email: { contains: query.search } } },
        { user: { phone: { contains: query.search } } },
        { recipientName: { contains: query.search } },
        { recipientPhone: { contains: query.search } },
      ];
    }
    if (query.from || query.to) {
      where.createdAt = {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      };
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: {
          ...orderSummaryInclude,
          user: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
    ]);
    return {
      items: rows.map(toAdminOrderSummary),
      pagination: buildPagination(query.page, query.limit, total),
    };
  }

  async adminGet(orderId: string): Promise<AdminOrderDetail> {
    const row = await this.requireDetail(orderId);
    return toAdminOrderDetail(row);
  }

  async adminSetStatus(
    orderId: string,
    to: OrderStatus,
    note: string | undefined,
    actorId: string,
  ): Promise<AdminOrderDetail> {
    if (!ADMIN_SETTABLE_STATUSES.includes(to)) {
      throw new UnprocessableAppException(
        'ORDER_STATUS_NOT_SETTABLE',
        'این وضعیت فقط از طریق فرایند پرداخت تعیین می‌شود',
      );
    }
    const row = await this.requireDetail(orderId);
    await this.prisma.$transaction((tx) =>
      this.transition(tx, orderId, row.status, to, note ?? null, actorId),
    );
    return this.adminGet(orderId);
  }

  async adminAddShipment(
    orderId: string,
    dto: CreateShipmentDto,
    actorId: string,
  ): Promise<AdminOrderDetail> {
    const row = await this.requireDetail(orderId);
    if (!['PROCESSING', 'PACKED', 'SHIPPED'].includes(row.status)) {
      throw new UnprocessableAppException(
        'ORDER_NOT_SHIPPABLE',
        'برای این سفارش نمی‌توان مرسوله ثبت کرد',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.shipment.create({
        data: {
          orderId,
          carrier: dto.carrier,
          trackingCode: dto.trackingCode,
          shippedAt: new Date(),
          tracking: {
            create: { status: 'SHIPPED', description: dto.note ?? 'مرسوله تحویل شرکت حمل شد' },
          },
        },
      });
      if (row.status !== 'SHIPPED') {
        const from = row.status;
        if (from === 'PROCESSING')
          await this.transition(tx, orderId, 'PROCESSING', 'PACKED', 'بسته‌بندی', actorId);
        await this.transition(tx, orderId, 'PACKED', 'SHIPPED', dto.note ?? null, actorId);
      }
    });
    return this.adminGet(orderId);
  }

  private async requireDetail(orderId: string): Promise<OrderDetailRow> {
    const row = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: orderDetailInclude,
    });
    if (!row) throw new NotFoundAppException('ORDER_NOT_FOUND', 'سفارش پیدا نشد');
    return row;
  }
}
