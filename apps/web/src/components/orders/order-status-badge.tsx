import { PAYMENT_STATUS_LABELS, type OrderStatus, type PaymentStatus } from '@pe/shared';
import { Badge } from '@/components/admin/badge';
import { orderStatusLabel, orderStatusTone, paymentStatusTone } from '@/lib/orders/status';

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={orderStatusTone(status)}>{orderStatusLabel(status)}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={paymentStatusTone(status)}>{PAYMENT_STATUS_LABELS[status] ?? status}</Badge>;
}
