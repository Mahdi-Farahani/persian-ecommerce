import { formatJalaliDateTime, formatToman, toPersianDigits } from '@pe/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { SellerBadge } from '@/components/seller/badge';
import { SellerOrderItems } from '@/components/seller/seller-order-items';
import { ShipmentForm } from '@/components/seller/shipment-form';
import { Card, CardTitle } from '@/components/ui/card';
import { t } from '@/i18n';
import { getApprovedSeller, getSellerOrder } from '@/lib/seller/server';

export const metadata: Metadata = { title: t.seller.orders.title, robots: { index: false } };

const copy = t.seller.orders;

export default async function SellerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const seller = await getApprovedSeller();
  if (!seller) return null;
  const { id } = await params;
  const order = await getSellerOrder(id);
  if (!order) notFound();
  const commission = order.itemsTotal - order.sellerTotal;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/seller/orders" className="text-xs text-ink-muted hover:text-brand-700">
            ‹ {copy.backToOrders}
          </Link>
          <h1 className="mt-1 text-xl font-bold">
            {t.orders.detailTitle(toPersianDigits(order.number))}
          </h1>
          <p className="text-xs text-ink-muted">
            {t.orders.date}: {formatJalaliDateTime(order.createdAt)}
            {order.paidAt ? ` · ${t.orders.paidAt}: ${formatJalaliDateTime(order.paidAt)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <OrderStatusBadge status={order.status} />
          <SellerBadge tone={order.awaitingShipment ? 'warning' : 'success'}>
            {order.awaitingShipment ? copy.awaitingBadge : copy.dispatched}
          </SellerBadge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardTitle>{copy.myItems}</CardTitle>
            <SellerOrderItems items={order.items} />
          </Card>

          {order.awaitingShipment ? <ShipmentForm orderId={order.id} /> : null}

          <Card>
            <CardTitle>{t.orders.shipments}</CardTitle>
            {order.shipments.length === 0 ? (
              <p className="text-sm text-ink-muted">{t.orders.noShipments}</p>
            ) : (
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
            )}
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardTitle>{t.orders.totals}</CardTitle>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-muted">{copy.itemsTotal}</dt>
                <dd className="tabular-nums">{formatToman(order.itemsTotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">{copy.commission}</dt>
                <dd className="tabular-nums">{formatToman(commission)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 font-bold">
                <dt>{copy.sellerTotal}</dt>
                <dd className="tabular-nums">{formatToman(order.sellerTotal)}</dd>
              </div>
            </dl>
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
