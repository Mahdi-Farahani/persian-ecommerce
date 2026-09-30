import type { OrderStatus } from '../generated/prisma/client.js';

/**
 * Allowed lifecycle transitions. Anything not listed is rejected, which keeps
 * the order history a faithful audit trail.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['RETURN_REQUESTED'],
  RETURN_REQUESTED: ['RETURNED', 'DELIVERED'],
  RETURNED: ['REFUNDED'],
  CANCELLED: ['REFUNDED'],
  REFUNDED: [],
};

/** Statuses an administrator may set manually (payment-driven ones excluded). */
export const ADMIN_SETTABLE_STATUSES: readonly OrderStatus[] = [
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'RETURNED',
  'REFUNDED',
];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/** Statuses in which stock is still reserved (not yet sold). */
export const RESERVED_STATUSES: readonly OrderStatus[] = ['PENDING_PAYMENT'];

/** Statuses in which stock has been sold and may be returned. */
export const SOLD_STATUSES: readonly OrderStatus[] = [
  'PAID',
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
  'RETURN_REQUESTED',
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'در انتظار پرداخت',
  PAID: 'پرداخت‌شده',
  PROCESSING: 'در حال پردازش',
  PACKED: 'بسته‌بندی‌شده',
  SHIPPED: 'ارسال‌شده',
  DELIVERED: 'تحویل‌شده',
  CANCELLED: 'لغوشده',
  RETURN_REQUESTED: 'درخواست مرجوعی',
  RETURNED: 'مرجوع‌شده',
  REFUNDED: 'بازپرداخت‌شده',
};
