import { formatPersianNumber, formatToman, toPersianDigits, type OrderItemView } from '@pe/shared';
import Image from 'next/image';
import Link from 'next/link';
import { adminFa } from '@/i18n/admin-fa';
import { assetUrl } from '@/lib/assets';

const copy = adminFa.orders;

interface AdminOrderItemsProps {
  items: OrderItemView[];
  /** Links seller names to their admin page when the viewer may open it. */
  canViewSellers: boolean;
}

/** Store name of the seller fulfilling a line, or the platform label. */
export function SellerName({
  seller,
  canViewSellers,
}: {
  seller: OrderItemView['seller'];
  canViewSellers: boolean;
}) {
  if (!seller) return <span>{copy.platformStock}</span>;
  if (!canViewSellers) return <span>{seller.storeName}</span>;
  return (
    <Link href={`/admin/sellers/${seller.id}`} className="text-brand-700 hover:underline">
      {seller.storeName}
    </Link>
  );
}

/** Line items of an order with the seller responsible for each line. */
export function AdminOrderItems({ items, canViewSellers }: AdminOrderItemsProps) {
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
              {item.productId ? (
                <Link
                  href={`/admin/products/${item.productId}`}
                  className="line-clamp-2 font-medium hover:text-brand-700"
                >
                  {item.productTitle}
                </Link>
              ) : (
                <p className="line-clamp-2 font-medium">{item.productTitle}</p>
              )}
              <p className="text-xs text-ink-muted">
                {item.variantTitle ? `${item.variantTitle} · ` : ''}
                {copy.quantity}: {formatPersianNumber(item.quantity)}
                {' · '}
                <span dir="ltr">{item.sku}</span>
              </p>
              <p className="text-xs">
                <span className="text-ink-muted">{copy.seller}: </span>
                <SellerName seller={item.seller} canViewSellers={canViewSellers} />
              </p>
            </div>
            <div className="text-end">
              <p className="font-medium tabular-nums">{formatToman(item.lineTotal)}</p>
              {item.quantity > 1 ? (
                <p className="text-xs text-ink-muted tabular-nums">
                  {toPersianDigits(item.quantity)} × {formatToman(item.unitPrice)}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
