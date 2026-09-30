import type { OrderStatus, PaymentStatus } from '@pe/shared';
import { ORDER_STATUS_LABELS } from '@/i18n/fa';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const orderTones: Record<OrderStatus, StatusTone> = {
  PENDING_PAYMENT: 'warning',
  PAID: 'success',
  PROCESSING: 'info',
  PACKED: 'info',
  SHIPPED: 'info',
  DELIVERED: 'success',
  CANCELLED: 'danger',
  RETURN_REQUESTED: 'warning',
  RETURNED: 'neutral',
  REFUNDED: 'neutral',
};

const paymentTones: Record<PaymentStatus, StatusTone> = {
  INITIATED: 'neutral',
  REDIRECTED: 'info',
  CALLBACK_RECEIVED: 'info',
  VERIFYING: 'info',
  PAID: 'success',
  FAILED: 'danger',
  CANCELLED: 'danger',
  EXPIRED: 'neutral',
  REFUNDED: 'warning',
};

export function orderStatusTone(status: OrderStatus): StatusTone {
  return orderTones[status] ?? 'neutral';
}

function isOrderStatus(value: string): value is OrderStatus {
  return Object.hasOwn(ORDER_STATUS_LABELS, value);
}

/** Label for a status; unknown values (e.g. loosely typed admin payloads) fall back to the raw code. */
export function orderStatusLabel(status: string): string {
  return isOrderStatus(status) ? ORDER_STATUS_LABELS[status] : status;
}

export function paymentStatusTone(status: PaymentStatus): StatusTone {
  return paymentTones[status] ?? 'neutral';
}

/** Statuses an administrator may move an order to. */
export const ADMIN_SETTABLE_ORDER_STATUSES: readonly OrderStatus[] = [
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'RETURNED',
  'REFUNDED',
];
