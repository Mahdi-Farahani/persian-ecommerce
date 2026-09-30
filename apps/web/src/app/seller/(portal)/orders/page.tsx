import { formatJalaliDate, formatPersianNumber, formatToman, toPersianDigits } from '@pe/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { SellerBadge } from '@/components/seller/badge';
import { Card } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { t } from '@/i18n';
import { pageHref, parsePage } from '@/lib/admin/server';
import { getApprovedSeller, listSellerOrders } from '@/lib/seller/server';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: t.seller.orders.title, robots: { index: false } };

const copy = t.seller.orders;
const PAGE_SIZE = 20;

type SearchParams = Promise<{ page?: string; awaiting?: string }>;

export default async function SellerOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const seller = await getApprovedSeller();
  if (!seller) return null;
  const params = await searchParams;
  const page = parsePage(params.page);
  const awaiting = params.awaiting === '1';
  const result = await listSellerOrders({
    page,
    limit: PAGE_SIZE,
    awaitingShipment: awaiting ? 'true' : undefined,
  });

  const tabClass = (active: boolean) =>
    cn(
      'rounded-lg px-3 py-1.5 text-sm font-medium transition',
      active ? 'bg-brand-50 text-brand-700' : 'text-ink-muted hover:bg-surface-muted',
    );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{copy.title}</h1>
      <nav
        aria-label={copy.title}
        className="flex gap-1 rounded-card border border-border bg-surface p-1"
      >
        <Link
          href="/seller/orders"
          className={tabClass(!awaiting)}
          aria-current={!awaiting ? 'page' : undefined}
        >
          {copy.all}
        </Link>
        <Link
          href="/seller/orders?awaiting=1"
          className={tabClass(awaiting)}
          aria-current={awaiting ? 'page' : undefined}
        >
          {copy.awaiting}
        </Link>
      </nav>

      {result.items.length === 0 ? (
        <Card className="py-16 text-center">
          <p className="text-ink-muted">{copy.empty}</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {result.items.map((order) => (
            <li key={order.id}>
              <Link href={`/seller/orders/${order.id}`} className="block">
                <Card className="grid gap-2 p-4 text-sm transition hover:border-brand-400 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="font-bold">
                      <span className="text-ink-muted">{t.orders.number}: </span>
                      <span dir="ltr" className="inline-block">
                        {toPersianDigits(order.number)}
                      </span>
                    </p>
                    <p className="text-xs text-ink-muted">
                      {formatJalaliDate(order.createdAt)} ·{' '}
                      {t.orders.itemsCount(formatPersianNumber(order.items.length))} ·{' '}
                      {copy.recipient}: {order.address.recipientName}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                    <div className="flex flex-wrap gap-2">
                      <OrderStatusBadge status={order.status} />
                      {order.awaitingShipment ? (
                        <SellerBadge tone="warning">{copy.awaitingBadge}</SellerBadge>
                      ) : null}
                    </div>
                    <span className="tabular-nums">
                      {copy.sellerTotal}: {formatToman(order.sellerTotal)}
                    </span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        pagination={result.pagination}
        hrefFor={pageHref('/seller/orders', { awaiting: awaiting ? '1' : undefined })}
      />
    </div>
  );
}
