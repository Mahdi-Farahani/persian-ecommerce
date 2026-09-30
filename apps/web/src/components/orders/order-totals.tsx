import type { OrderSummary } from '@pe/shared';
import { Price } from '@/components/catalog/price';
import { t } from '@/i18n';

/** Money breakdown of an order. */
export function OrderTotals({ order }: { order: OrderSummary }) {
  return (
    <dl className="flex flex-col gap-2 text-sm">
      <div className="flex justify-between">
        <dt className="text-ink-muted">{t.orders.subtotal}</dt>
        <dd>
          <Price amount={order.subtotal} size="sm" />
        </dd>
      </div>
      {order.discount > 0 ? (
        <div className="flex justify-between text-green-700">
          <dt>{t.orders.discount}</dt>
          <dd>
            −<Price amount={order.discount} size="sm" className="text-green-700" />
          </dd>
        </div>
      ) : null}
      <div className="flex justify-between">
        <dt className="text-ink-muted">{t.orders.shippingFee}</dt>
        <dd>
          {order.shippingFee === 0 ? t.common.free : <Price amount={order.shippingFee} size="sm" />}
        </dd>
      </div>
      <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
        <dt>{t.orders.grandTotal}</dt>
        <dd>
          <Price amount={order.total} size="md" />
        </dd>
      </div>
    </dl>
  );
}
