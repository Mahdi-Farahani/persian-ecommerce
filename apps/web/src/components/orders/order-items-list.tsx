import { toPersianDigits, type OrderItemView } from '@pe/shared';
import Image from 'next/image';
import Link from 'next/link';
import { Price } from '@/components/catalog/price';
import { SellerLine } from '@/components/catalog/seller-line';
import { t } from '@/i18n';
import { assetUrl } from '@/lib/assets';

/** Line items of an order (customer and admin views share this list). */
export function OrderItemsList({ items }: { items: OrderItemView[] }) {
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
              <SellerLine seller={item.seller} className="mt-0.5" />
            </div>
            <div className="text-end">
              <Price amount={item.lineTotal} size="sm" />
              {item.quantity > 1 ? (
                <p className="text-xs text-ink-muted">
                  {toPersianDigits(item.quantity)} ×{' '}
                  <Price amount={item.unitPrice} compareAt={item.compareAtPrice} size="sm" />
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
