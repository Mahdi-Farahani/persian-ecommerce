import Link from 'next/link';
import { adminFa } from '@/i18n/admin-fa';
import { cn } from '@/lib/utils';

export const SELLER_TABS = ['offers', 'orders', 'settlements'] as const;
export type SellerTab = (typeof SELLER_TABS)[number];

export function pickSellerTab(value: string | undefined): SellerTab {
  return value && (SELLER_TABS as readonly string[]).includes(value)
    ? (value as SellerTab)
    : 'offers';
}

/** Link-based tab bar (works without JS); the active tab lives in the URL. */
export function SellerTabs({ sellerId, active }: { sellerId: string; active: SellerTab }) {
  const copy = adminFa.sellers.tabs;
  return (
    <nav aria-label={copy.label} className="mb-4 flex flex-wrap gap-1 border-b border-border">
      {SELLER_TABS.map((tab) => {
        const current = tab === active;
        return (
          <Link
            key={tab}
            href={
              tab === 'offers'
                ? `/admin/sellers/${sellerId}`
                : `/admin/sellers/${sellerId}?tab=${tab}`
            }
            aria-current={current ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition',
              current
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {copy[tab]}
          </Link>
        );
      })}
    </nav>
  );
}
