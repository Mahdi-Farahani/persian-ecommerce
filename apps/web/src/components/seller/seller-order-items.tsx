import { formatToman, toPersianDigits, type SellerOrderItemView } from '@pe/shared';
import Image from 'next/image';
import Link from 'next/link';
import { Price } from '@/components/catalog/price';
import { t } from '@/i18n';
import { assetUrl } from '@/lib/assets';
import { SellerBadge } from './badge';

const copy = t.seller.orders;

/** The seller's own lines of an order with the commission split per line. */
export function SellerOrderItems({ items }: { items: SellerOrderItemView[] }) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {items.map((item) => {
        const image = assetUrl(item.imageUrl);
        return (
          <li key={item.id} className="flex items-center gap-3 p-3 text-sm">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
              {image ? (
                <Image
                  src={image}
                  alt={item.productTitle}
                  fill
                  sizes="64px"
                  className="object-cover"
                  unoptimized
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <Link
                href={`/products/${item.productSlug}`}
                className="line-clamp-2 font-medium hover:text-brand-700"
              >
                {item.productTitle}
              </Link>
              <p className="text-xs text-ink-muted">
                {item.variantTitle ? `${item.variantTitle} · ` : ''}
                {t.orders.quantity(toPersianDigits(item.quantity))}
                {' · '}
                <span dir="ltr">{item.sku}</span>
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {copy.commission}: {formatToman(item.commissionAmount)} · {copy.sellerTotal}:{' '}
                <span className="font-medium text-ink">{formatToman(item.sellerAmount)}</span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 text-end">
              <Price amount={item.lineTotal} size="sm" />
              <SellerBadge tone={item.settlementId ? 'success' : 'neutral'}>
                {item.settlementId ? copy.settled : copy.unsettled}
              </SellerBadge>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
