import type { SellerPublicView } from '@pe/shared';
import Link from 'next/link';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

/** "فروشنده: …" for a variant/line; platform stock is attributed to the marketplace itself. */
export function SellerLine({
  seller,
  className,
}: {
  seller: SellerPublicView | null;
  className?: string;
}) {
  return (
    <p className={cn('text-xs text-ink-muted', className)}>
      {t.seller.storefront.seller}:{' '}
      {seller ? (
        <Link
          href={`/sellers/${seller.slug}`}
          className="font-medium text-ink hover:text-brand-700"
        >
          {seller.storeName}
        </Link>
      ) : (
        <span className="font-medium text-ink">{t.app.name}</span>
      )}
    </p>
  );
}

/** Display name of the party fulfilling a line (store name or the marketplace). */
export function sellerName(seller: SellerPublicView | null): string {
  return seller ? seller.storeName : t.app.name;
}
