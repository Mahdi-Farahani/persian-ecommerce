import {
  CUSTOMER_CANCELLABLE_STATUSES,
  formatOrderNumber,
  type AdminOrderDetail,
  type AdminOrderSummary,
  type OrderDetail,
  type OrderSummary,
  type PaymentView,
} from '@pe/shared';
import { money, moneyOrNull } from '../common/utils/money.util.js';
import type { Payment, Prisma } from '../generated/prisma/client.js';

export const orderSummaryInclude = {
  items: { select: { quantity: true, imageUrl: true }, orderBy: { id: 'asc' } },
} satisfies Prisma.OrderInclude;

export const orderDetailInclude = {
  items: {
    orderBy: { id: 'asc' },
    include: { seller: { select: { id: true, storeName: true, slug: true } } },
  },
  statusHistory: { orderBy: { createdAt: 'asc' } },
  payments: { orderBy: { attemptNumber: 'asc' } },
  shipments: {
    include: { tracking: { orderBy: { occurredAt: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  },
  user: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
} satisfies Prisma.OrderInclude;

export type OrderSummaryRow = Prisma.OrderGetPayload<{ include: typeof orderSummaryInclude }> & {
  user?: {
    id: string;
    email: string | null;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
  };
};
export type OrderDetailRow = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

export function toPaymentView(payment: Payment, orderNumber: number): PaymentView {
  return {
    id: payment.id,
    orderId: payment.orderId,
    orderNumber: formatOrderNumber(orderNumber),
    provider: payment.provider,
    environment: payment.environment,
    attemptNumber: payment.attemptNumber,
    amount: money(payment.amount),
    currency: 'IRR',
    status: payment.status,
    providerAuthority: payment.providerAuthority,
    providerTransactionId: payment.providerTransactionId,
    cardPanMask: payment.cardPanMask,
    errorCode: payment.errorCode,
    errorMessage: payment.errorMessage,
    createdAt: payment.createdAt.toISOString(),
    verifiedAt: payment.verifiedAt?.toISOString() ?? null,
  };
}

export function toOrderSummary(row: OrderSummaryRow): OrderSummary {
  return {
    id: row.id,
    number: formatOrderNumber(row.number),
    status: row.status,
    itemCount: row.items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal: money(row.subtotal),
    discount: money(row.discount),
    shippingFee: money(row.shippingFee),
    total: money(row.total),
    currency: 'IRR',
    paymentDeadlineAt: row.paymentDeadlineAt.toISOString(),
    paidAt: row.paidAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    previewImageUrl: row.items.find((i) => i.imageUrl)?.imageUrl ?? null,
  };
}

function customerOf(user: NonNullable<OrderSummaryRow['user']>): AdminOrderSummary['customer'] {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    name:
      [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || user.phone || '',
  };
}

export function toAdminOrderSummary(
  row: OrderSummaryRow & { user: NonNullable<OrderSummaryRow['user']> },
): AdminOrderSummary {
  return { ...toOrderSummary(row), customer: customerOf(row.user) };
}

export function toOrderDetail(row: OrderDetailRow, now = new Date()): OrderDetail {
  const summary = toOrderSummary({
    ...row,
    items: row.items.map((i) => ({ quantity: i.quantity, imageUrl: i.imageUrl })),
  });
  return {
    ...summary,
    items: row.items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      productId: item.productId,
      productTitle: item.productTitle,
      productSlug: item.productSlug,
      variantTitle: item.variantTitle,
      sku: item.sku,
      imageUrl: item.imageUrl,
      unitPrice: money(item.unitPrice),
      compareAtPrice: moneyOrNull(item.compareAtPrice),
      quantity: item.quantity,
      lineTotal: money(item.lineTotal),
      seller: item.seller
        ? { id: item.seller.id, storeName: item.seller.storeName, slug: item.seller.slug }
        : null,
    })),
    address: {
      recipientName: row.recipientName,
      recipientPhone: row.recipientPhone,
      province: row.province,
      city: row.city,
      addressLine: row.addressLine,
      postalCode: row.postalCode,
    },
    shippingMethodCode: row.shippingMethodCode,
    shippingMethodName: row.shippingMethodName,
    estimatedDaysMin: row.estimatedDaysMin,
    estimatedDaysMax: row.estimatedDaysMax,
    couponCode: row.couponCode,
    customerNote: row.customerNote,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancelReason: row.cancelReason,
    statusHistory: row.statusHistory.map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      note: h.note,
      createdAt: h.createdAt.toISOString(),
    })),
    payments: row.payments.map((p) => toPaymentView(p, row.number)),
    shipments: row.shipments.map((s) => ({
      id: s.id,
      sellerId: s.sellerId,
      carrier: s.carrier,
      trackingCode: s.trackingCode,
      shippedAt: s.shippedAt?.toISOString() ?? null,
      deliveredAt: s.deliveredAt?.toISOString() ?? null,
      events: s.tracking.map((t) => ({
        id: t.id,
        status: t.status,
        description: t.description,
        occurredAt: t.occurredAt.toISOString(),
      })),
    })),
    payable: row.status === 'PENDING_PAYMENT' && row.paymentDeadlineAt.getTime() > now.getTime(),
    cancellable: CUSTOMER_CANCELLABLE_STATUSES.includes(row.status),
  };
}

export function toAdminOrderDetail(row: OrderDetailRow): AdminOrderDetail {
  return { ...toOrderDetail(row), customer: customerOf(row.user) };
}
