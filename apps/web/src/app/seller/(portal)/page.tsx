import { formatPersianNumber, formatToman } from '@pe/shared';
import Link from 'next/link';
import { KpiCard } from '@/components/seller/kpi-card';
import { t } from '@/i18n';
import { getApprovedSeller, getSellerDashboard } from '@/lib/seller/server';

const copy = t.seller.dashboard;

const linkClass = 'text-sm font-medium text-brand-700 hover:underline';

export default async function SellerDashboardPage() {
  const seller = await getApprovedSeller();
  if (!seller) return null;
  const dashboard = await getSellerDashboard();
  const { sales, offers, settlements } = dashboard;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">{copy.title}</h1>
        <p className="text-sm text-ink-muted">{seller.storeName}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={copy.sales7}
          value={formatToman(sales.last7Days.revenue)}
          hint={copy.ordersCount(formatPersianNumber(sales.last7Days.orders))}
        />
        <KpiCard
          label={copy.sales30}
          value={formatToman(sales.last30Days.revenue)}
          hint={copy.ordersCount(formatPersianNumber(sales.last30Days.orders))}
        />
        <KpiCard
          label={copy.awaitingShipment}
          value={formatPersianNumber(dashboard.awaitingShipment)}
          hint={copy.awaitingShipmentHint}
          className={dashboard.awaitingShipment > 0 ? 'border-amber-300 bg-amber-50/40' : undefined}
        >
          <Link href="/seller/orders?awaiting=1" className={linkClass}>
            {copy.viewAwaiting}
          </Link>
        </KpiCard>
        <KpiCard
          label={copy.offers}
          value={formatPersianNumber(offers.total)}
          hint={
            <>
              {copy.offersActive(formatPersianNumber(offers.active))} · {copy.lowStock}:{' '}
              {formatPersianNumber(offers.lowStock)} · {copy.outOfStock}:{' '}
              {formatPersianNumber(offers.outOfStock)}
            </>
          }
        >
          <Link href="/seller/products" className={linkClass}>
            {copy.manageOffers}
          </Link>
        </KpiCard>
        <KpiCard
          label={copy.pendingSettlement}
          value={formatToman(settlements.pendingAmount)}
          hint={copy.pendingItems(formatPersianNumber(settlements.pendingItems))}
        >
          <Link href="/seller/settlements" className={linkClass}>
            {copy.viewSettlements}
          </Link>
        </KpiCard>
        <KpiCard label={copy.paidSettlement} value={formatToman(settlements.paidAmount)} />
      </div>
    </div>
  );
}
