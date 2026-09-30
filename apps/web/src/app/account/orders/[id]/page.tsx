import {
  PAYMENT_PROVIDER_LABELS,
  formatJalaliDateTime,
  formatPersianNumber,
  formatToman,
  toPersianDigits,
} from '@pe/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OrderActions } from '@/components/orders/order-actions';
import { OrderItemsList } from '@/components/orders/order-items-list';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/orders/order-status-badge';
import { OrderTimeline } from '@/components/orders/order-timeline';
import { OrderTotals } from '@/components/orders/order-totals';
import { Alert } from '@/components/ui/alert';
import { Card, CardTitle } from '@/components/ui/card';
import { t } from '@/i18n';
import { requireUser } from '@/lib/auth/server';
import { getMyOrder } from '@/lib/orders/server';

export const metadata: Metadata = { title: t.orders.title, robots: { index: false } };

export default async function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser(`/account/orders/${id}`);
  const order = await getMyOrder(id);
  if (!order) notFound();

  const deadlinePassed = order.status === 'PENDING_PAYMENT' && !order.payable && !order.cancellable;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/account/orders" className="text-xs text-ink-muted hover:text-brand-700">
            ‹ {t.orders.backToOrders}
          </Link>
          <h1 className="mt-1 text-xl font-bold">
            {t.orders.detailTitle(toPersianDigits(order.number))}
          </h1>
          <p className="text-xs text-ink-muted">
            {t.orders.date}: {formatJalaliDateTime(order.createdAt)}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {deadlinePassed ? <Alert tone="warning">{t.orders.paymentDeadlinePassed}</Alert> : null}
      {order.status === 'PENDING_PAYMENT' && order.payable ? (
        <Alert tone="info">
          {t.orders.paymentDeadline}: {formatJalaliDateTime(order.paymentDeadlineAt)}
        </Alert>
      ) : null}
      {order.cancelReason ? (
        <Alert tone="warning">
          {t.orders.cancelReason}: {order.cancelReason}
        </Alert>
      ) : null}

      <OrderActions order={order} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardTitle>{t.orders.items}</CardTitle>
            <OrderItemsList items={order.items} />
          </Card>

          <Card>
            <CardTitle>{t.orders.payments}</CardTitle>
            {order.payments.length === 0 ? (
              <p className="text-sm text-ink-muted">{t.orders.noPayments}</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {order.payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <div>
                      <p className="font-medium">
                        {PAYMENT_PROVIDER_LABELS[payment.provider]} ·{' '}
                        {t.orders.paymentAttempt(formatPersianNumber(payment.attemptNumber))}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {formatJalaliDateTime(payment.createdAt)}
                        {payment.providerTransactionId ? (
                          <>
                            {' · '}
                            {t.payment.refId}:{' '}
                            <span dir="ltr">{toPersianDigits(payment.providerTransactionId)}</span>
                          </>
                        ) : null}
                      </p>
                      {payment.errorMessage ? (
                        <p className="text-xs text-accent-600">{payment.errorMessage}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums">{formatToman(payment.amount)}</span>
                      <PaymentStatusBadge status={payment.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle>{t.orders.timeline}</CardTitle>
            <OrderTimeline events={order.statusHistory} />
          </Card>

          {order.shipments.length > 0 ? (
            <Card>
              <CardTitle>{t.orders.shipments}</CardTitle>
              <ul className="flex flex-col gap-3 text-sm">
                {order.shipments.map((shipment) => (
                  <li key={shipment.id} className="rounded-lg border border-border p-3">
                    <p>
                      <span className="text-ink-muted">{t.orders.carrier}: </span>
                      {shipment.carrier ?? '—'}
                    </p>
                    <p>
                      <span className="text-ink-muted">{t.orders.trackingCode}: </span>
                      <span dir="ltr" className="inline-block">
                        {shipment.trackingCode ? toPersianDigits(shipment.trackingCode) : '—'}
                      </span>
                    </p>
                    {shipment.shippedAt ? (
                      <p className="text-xs text-ink-muted">
                        {t.orders.shippedAt}: {formatJalaliDateTime(shipment.shippedAt)}
                      </p>
                    ) : null}
                    {shipment.deliveredAt ? (
                      <p className="text-xs text-ink-muted">
                        {t.orders.deliveredAt}: {formatJalaliDateTime(shipment.deliveredAt)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardTitle>{t.orders.totals}</CardTitle>
            <OrderTotals order={order} />
            {order.couponCode ? (
              <p className="mt-3 text-xs text-ink-muted">
                {t.orders.coupon}: <span dir="ltr">{order.couponCode}</span>
              </p>
            ) : null}
          </Card>
          <Card className="text-sm">
            <CardTitle>{t.orders.address}</CardTitle>
            <p className="font-medium">{order.address.recipientName}</p>
            <p className="text-ink-muted">
              {order.address.province}، {order.address.city}، {order.address.addressLine}
            </p>
            <p className="mt-1 text-xs text-ink-muted" dir="ltr">
              {toPersianDigits(order.address.recipientPhone)} ·{' '}
              {toPersianDigits(order.address.postalCode)}
            </p>
          </Card>
          <Card className="text-sm">
            <CardTitle>{t.orders.shipping}</CardTitle>
            <p className="font-medium">{order.shippingMethodName}</p>
            <p className="text-xs text-ink-muted">
              {order.estimatedDaysMax === 0
                ? t.orders.deliverySameDay
                : t.orders.deliveryEstimate(
                    formatPersianNumber(order.estimatedDaysMin),
                    formatPersianNumber(order.estimatedDaysMax),
                  )}
            </p>
            {order.customerNote ? (
              <p className="mt-3 text-xs">
                <span className="text-ink-muted">{t.orders.customerNote}: </span>
                {order.customerNote}
              </p>
            ) : null}
          </Card>
        </aside>
      </div>
    </div>
  );
}
