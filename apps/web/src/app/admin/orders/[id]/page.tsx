import {
  PAYMENT_PROVIDER_LABELS,
  formatJalaliDateTime,
  formatPersianNumber,
  formatToman,
  hasPermission,
  toPersianDigits,
} from '@pe/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OrderStatusForm } from '@/components/admin/orders/order-status-form';
import { ShipmentForm } from '@/components/admin/orders/shipment-form';
import { PageHeader } from '@/components/admin/page-header';
import { OrderItemsList } from '@/components/orders/order-items-list';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/orders/order-status-badge';
import { OrderTimeline } from '@/components/orders/order-timeline';
import { OrderTotals } from '@/components/orders/order-totals';
import { Card, CardTitle } from '@/components/ui/card';
import { adminFa } from '@/i18n/admin-fa';
import { AdminPermissions } from '@/lib/admin/navigation';
import { adminGetOrder } from '@/lib/admin/server';
import { requireUser } from '@/lib/auth/server';

export const metadata = { title: adminFa.orders.detailTitle };

const copy = adminFa.orders;

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/admin/orders/${id}`);
  const order = await adminGetOrder(id);
  if (!order) notFound();
  const canManage = hasPermission(user, AdminPermissions.ordersManage);
  const canViewPayments = hasPermission(user, AdminPermissions.paymentView);

  const facts: Array<{ label: string; value: string; ltr?: boolean }> = [
    { label: copy.customer, value: order.customer.name || copy.noName },
    { label: copy.paymentDeadline, value: formatJalaliDateTime(order.paymentDeadlineAt) },
  ];
  if (order.customer.email) {
    facts.push({ label: copy.email, value: order.customer.email, ltr: true });
  }
  if (order.customer.phone) {
    facts.push({ label: copy.phone, value: toPersianDigits(order.customer.phone), ltr: true });
  }
  if (order.paidAt) facts.push({ label: copy.paidAt, value: formatJalaliDateTime(order.paidAt) });
  if (order.cancelledAt) {
    facts.push({ label: copy.cancelledAt, value: formatJalaliDateTime(order.cancelledAt) });
  }
  if (order.cancelReason) facts.push({ label: copy.cancelReason, value: order.cancelReason });
  if (order.couponCode) facts.push({ label: copy.coupon, value: order.couponCode, ltr: true });
  if (order.customerNote) facts.push({ label: copy.customerNote, value: order.customerNote });

  return (
    <div>
      <PageHeader
        title={`${copy.detailTitle} ${toPersianDigits(order.number)}`}
        description={formatJalaliDateTime(order.createdAt)}
        actions={<OrderStatusBadge status={order.status} />}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardTitle>{copy.items}</CardTitle>
            <OrderItemsList items={order.items} />
          </Card>

          <Card>
            <CardTitle>{copy.payments}</CardTitle>
            {order.payments.length === 0 ? (
              <p className="text-sm text-ink-muted">{copy.noPayments}</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {order.payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <div>
                      <p className="font-medium">
                        {PAYMENT_PROVIDER_LABELS[payment.provider]} · #
                        {formatPersianNumber(payment.attemptNumber)}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {formatJalaliDateTime(payment.createdAt)}
                        {payment.providerTransactionId ? (
                          <>
                            {' · '}
                            <span dir="ltr">{payment.providerTransactionId}</span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums">{formatToman(payment.amount)}</span>
                      <PaymentStatusBadge status={payment.status} />
                      {canViewPayments ? (
                        <Link
                          href={`/admin/payments/${payment.id}`}
                          className="text-xs font-medium text-brand-700 hover:underline"
                        >
                          {copy.viewPayment}
                        </Link>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle>{copy.shipments}</CardTitle>
            {order.shipments.length === 0 ? (
              <p className="text-sm text-ink-muted">{copy.noShipments}</p>
            ) : (
              <ul className="mb-4 flex flex-col gap-3 text-sm">
                {order.shipments.map((shipment) => (
                  <li key={shipment.id} className="rounded-lg border border-border p-3">
                    <p>
                      <span className="text-ink-muted">{copy.carrier}: </span>
                      {shipment.carrier ?? adminFa.common.none}
                    </p>
                    <p>
                      <span className="text-ink-muted">{copy.trackingCode}: </span>
                      <span dir="ltr" className="inline-block">
                        {shipment.trackingCode ?? adminFa.common.none}
                      </span>
                    </p>
                    {shipment.shippedAt ? (
                      <p className="text-xs text-ink-muted">
                        {copy.shippedAt}: {formatJalaliDateTime(shipment.shippedAt)}
                      </p>
                    ) : null}
                    {shipment.deliveredAt ? (
                      <p className="text-xs text-ink-muted">
                        {copy.deliveredAt}: {formatJalaliDateTime(shipment.deliveredAt)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {canManage ? <ShipmentForm orderId={order.id} /> : null}
          </Card>

          <Card>
            <CardTitle>{copy.timeline}</CardTitle>
            <OrderTimeline events={order.statusHistory} />
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          {canManage ? (
            <Card>
              <CardTitle>{copy.changeStatus}</CardTitle>
              <OrderStatusForm key={order.status} order={order} />
            </Card>
          ) : null}
          <Card>
            <CardTitle>{copy.totals}</CardTitle>
            <OrderTotals order={order} />
          </Card>
          <Card className="text-sm">
            <dl className="grid gap-3">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="text-xs text-ink-muted">{fact.label}</dt>
                  <dd className="font-medium" dir={fact.ltr ? 'ltr' : undefined}>
                    <span className={fact.ltr ? 'inline-block text-start' : undefined}>
                      {fact.value}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card className="text-sm">
            <CardTitle>{copy.address}</CardTitle>
            <p className="font-medium">{order.address.recipientName}</p>
            <p className="text-ink-muted">
              {order.address.province}، {order.address.city}، {order.address.addressLine}
            </p>
            <p className="mt-1 text-xs text-ink-muted" dir="ltr">
              {toPersianDigits(order.address.recipientPhone)} ·{' '}
              {toPersianDigits(order.address.postalCode)}
            </p>
            <p className="mt-3 text-xs">
              <span className="text-ink-muted">{copy.shipping}: </span>
              {order.shippingMethodName}
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
