import { Injectable } from '@nestjs/common';
import {
  buildPagination,
  type Paginated,
  type SellerDashboard,
  type SellerOrderView,
} from '@pe/shared';
import { NotFoundAppException } from '../common/errors/app.exception.js';
import { money } from '../common/utils/money.util.js';
import type { Prisma, Seller } from '../generated/prisma/client.js';
import { OrdersService } from '../orders/orders.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SellerOrdersQueryDto, SellerShipmentDto } from './dto/seller.dto.js';
import { sellerOrderInclude, toSellerOrder, toSellerProfile } from './sellers.mapper.js';

const DAY_MS = 86_400_000;
const FULFILLABLE = ['PAID', 'PROCESSING', 'PACKED'] as const;

/** Orders as seen by one seller: only orders containing their items, and only those items. */
@Injectable()
export class SellerOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  async list(sellerId: string, query: SellerOrdersQueryDto): Promise<Paginated<SellerOrderView>> {
    const where: Prisma.OrderWhereInput = {
      items: { some: { sellerId } },
      // Sellers never see unpaid carts-turned-orders.
      status: { notIn: ['PENDING_PAYMENT'] },
    };
    if (query.awaitingShipment) {
      where.status = { in: [...FULFILLABLE] };
      where.shipments = { none: { sellerId } };
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: sellerOrderInclude,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
    ]);
    return {
      items: rows.map((r) => toSellerOrder(r, sellerId)),
      pagination: buildPagination(query.page, query.limit, total),
    };
  }

  async get(sellerId: string, orderId: string): Promise<SellerOrderView> {
    const row = await this.prisma.order.findFirst({
      where: { id: orderId, items: { some: { sellerId } }, status: { notIn: ['PENDING_PAYMENT'] } },
      include: sellerOrderInclude,
    });
    if (!row) throw new NotFoundAppException('ORDER_NOT_FOUND', 'سفارش پیدا نشد');
    return toSellerOrder(row, sellerId);
  }

  async ship(
    sellerId: string,
    orderId: string,
    dto: SellerShipmentDto,
    actorId: string,
  ): Promise<SellerOrderView> {
    await this.get(sellerId, orderId);
    await this.prisma.$transaction((tx) =>
      this.orders.registerShipment(tx, orderId, { sellerId, ...dto }, actorId),
    );
    return this.get(sellerId, orderId);
  }

  async dashboard(seller: Seller): Promise<SellerDashboard> {
    const now = Date.now();
    const [sales7, sales30, awaiting, offers, pendingSettlement, paidSettlement] =
      await Promise.all([
        this.sales(seller.id, new Date(now - 7 * DAY_MS)),
        this.sales(seller.id, new Date(now - 30 * DAY_MS)),
        this.prisma.order.count({
          where: {
            status: { in: [...FULFILLABLE] },
            items: { some: { sellerId: seller.id } },
            shipments: { none: { sellerId: seller.id } },
          },
        }),
        this.prisma.productVariant.findMany({
          where: { sellerId: seller.id },
          select: {
            status: true,
            inventory: {
              select: { stockQuantity: true, reservedQuantity: true, lowStockThreshold: true },
            },
          },
        }),
        this.prisma.orderItem.aggregate({
          where: { sellerId: seller.id, settlementId: null, order: { status: 'DELIVERED' } },
          _sum: { sellerAmount: true },
          _count: { _all: true },
        }),
        this.prisma.settlement.aggregate({
          where: { sellerId: seller.id, status: 'PAID' },
          _sum: { netAmount: true },
        }),
      ]);
    const available = (o: (typeof offers)[number]): number =>
      Math.max(0, (o.inventory?.stockQuantity ?? 0) - (o.inventory?.reservedQuantity ?? 0));
    return {
      seller: toSellerProfile(seller),
      sales: { last7Days: sales7, last30Days: sales30 },
      awaitingShipment: awaiting,
      offers: {
        total: offers.length,
        active: offers.filter((o) => o.status === 'ACTIVE').length,
        lowStock: offers.filter(
          (o) => available(o) > 0 && available(o) <= (o.inventory?.lowStockThreshold ?? 0),
        ).length,
        outOfStock: offers.filter((o) => available(o) === 0).length,
      },
      settlements: {
        pendingAmount: money(pendingSettlement._sum.sellerAmount ?? 0n),
        pendingItems: pendingSettlement._count._all,
        paidAmount: money(paidSettlement._sum.netAmount ?? 0n),
      },
    };
  }

  private async sales(sellerId: string, since: Date): Promise<{ orders: number; revenue: number }> {
    const rows = await this.prisma.orderItem.groupBy({
      by: ['orderId'],
      where: {
        sellerId,
        order: {
          paidAt: { gte: since },
          status: { notIn: ['PENDING_PAYMENT', 'CANCELLED', 'REFUNDED'] },
        },
      },
      _sum: { lineTotal: true },
    });
    return {
      orders: rows.length,
      revenue: rows.reduce((sum, r) => sum + money(r._sum.lineTotal ?? 0n), 0),
    };
  }
}
