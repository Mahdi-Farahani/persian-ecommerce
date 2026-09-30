import { formatJalaliDate, formatPersianNumber, toPersianDigits } from '@pe/shared';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Price } from '@/components/catalog/price';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { Card } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { t } from '@/i18n';
import { pageHref, parsePage } from '@/lib/admin/server';
import { assetUrl } from '@/lib/assets';
import { requireUser } from '@/lib/auth/server';
import { listMyOrders } from '@/lib/orders/server';

export const metadata: Metadata = { title: t.orders.title, robots: { index: false } };

const PAGE_SIZE = 10;

export default async function AccountOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  await requireUser(page > 1 ? `/account/orders?page=${page}` : '/account/orders');
  const result = await listMyOrders(page, PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t.orders.title}</h1>
      {result.items.length === 0 ? (
        <Card className="py-16 text-center">
          <p className="text-ink-muted">{t.orders.empty}</p>
          <Link
            href="/products"
            className="mt-4 inline-flex rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700"
          >
            {t.cart.browse}
          </Link>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {result.items.map((order) => {
            const image = assetUrl(order.previewImageUrl);
            return (
              <li key={order.id}>
                <Link href={`/account/orders/${order.id}`} className="block">
                  <Card className="flex items-center gap-4 p-4 transition hover:border-brand-400">
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
                      {image ? (
                        <Image
                          src={image}
                          alt=""
                          fill
                          sizes="64px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : null}
                    </div>
                    <div className="grid min-w-0 flex-1 gap-1 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
                      <div className="min-w-0">
                        <p className="font-bold">
                          <span className="text-ink-muted">{t.orders.number}: </span>
                          <span dir="ltr" className="inline-block">
                            {toPersianDigits(order.number)}
                          </span>
                        </p>
                        <p className="text-xs text-ink-muted">
                          {formatJalaliDate(order.createdAt)} ·{' '}
                          {t.orders.itemsCount(formatPersianNumber(order.itemCount))}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                        <OrderStatusBadge status={order.status} />
                        <Price amount={order.total} size="sm" />
                      </div>
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination pagination={result.pagination} hrefFor={pageHref('/account/orders', {})} />
    </div>
  );
}
