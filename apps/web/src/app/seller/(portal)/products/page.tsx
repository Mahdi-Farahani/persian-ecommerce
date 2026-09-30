import type { Metadata } from 'next';
import Link from 'next/link';
import { OffersTable } from '@/components/seller/offers-table';
import { Pagination } from '@/components/ui/pagination';
import { t } from '@/i18n';
import { pageHref, parsePage } from '@/lib/admin/server';
import { getApprovedSeller, listSellerOffers } from '@/lib/seller/server';

export const metadata: Metadata = { title: t.seller.offers.title, robots: { index: false } };

const copy = t.seller.offers;
const PAGE_SIZE = 20;

type SearchParams = Promise<{ page?: string; q?: string; lowStock?: string }>;

export default async function SellerProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const seller = await getApprovedSeller();
  if (!seller) return null;
  const params = await searchParams;
  const page = parsePage(params.page);
  const search = params.q?.trim() || undefined;
  const lowStock = params.lowStock === '1';
  const result = await listSellerOffers({
    page,
    limit: PAGE_SIZE,
    search,
    lowStock: lowStock ? 'true' : undefined,
  });
  const filters = { q: search, lowStock: lowStock ? '1' : undefined };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{copy.title}</h1>
        <Link
          href="/seller/products/new"
          className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700"
        >
          {copy.add}
        </Link>
      </div>

      <form
        method="get"
        action="/seller/products"
        className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-3"
      >
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">{copy.search}</span>
          <input
            type="search"
            name="q"
            defaultValue={search ?? ''}
            placeholder={copy.searchPlaceholder}
            className="h-10 rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="lowStock"
            value="1"
            defaultChecked={lowStock}
            className="size-4 accent-brand-600"
          />
          {copy.lowStockOnly}
        </label>
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-lg bg-surface-muted px-4 text-sm font-bold hover:bg-border"
        >
          {copy.filter}
        </button>
        {search || lowStock ? (
          <Link href="/seller/products" className="text-sm text-ink-muted hover:text-brand-700">
            {copy.clearFilter}
          </Link>
        ) : null}
      </form>

      <OffersTable offers={result.items} filtered={Boolean(search || lowStock)} />
      <Pagination pagination={result.pagination} hrefFor={pageHref('/seller/products', filters)} />
    </div>
  );
}
