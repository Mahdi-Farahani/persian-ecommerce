import type { ProductCard as ProductCardData } from '@pe/shared';
import { toPersianDigits } from '@pe/shared';
import Image from 'next/image';
import Link from 'next/link';
import { WishlistButton } from '@/components/wishlist/wishlist-button';
import { t } from '@/i18n';
import { assetUrl } from '@/lib/assets';
import { Price } from './price';

export function ProductCard({ product }: { product: ProductCardData }) {
  const image = assetUrl(product.image?.url);
  const href = `/products/${product.slug}`;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface transition hover:shadow-md">
      {/* Rendered outside the anchor so toggling never navigates. */}
      <WishlistButton productId={product.id} className="absolute end-2 top-2 z-10" />
      <Link href={href} className="relative block aspect-square overflow-hidden bg-surface-muted">
        {image ? (
          <Image
            src={image}
            alt={product.image?.alt ?? product.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="grid h-full place-items-center text-sm text-ink-muted">
            {t.catalog.noImage}
          </span>
        )}
        {!product.inStock ? (
          <span className="absolute start-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-xs text-white">
            {t.catalog.outOfStock}
          </span>
        ) : product.discountPercent > 0 ? (
          <span className="absolute start-2 top-2 rounded-full bg-accent-500 px-2 py-0.5 text-xs font-bold text-white">
            {toPersianDigits(product.discountPercent)}٪ {t.catalog.discount}
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3">
        {product.brand ? (
          <span className="text-xs text-ink-muted">{product.brand.name}</span>
        ) : null}
        <h3 className="line-clamp-2 min-h-[2.8em] text-sm font-medium leading-6">
          <Link href={href} className="hover:text-brand-700">
            {product.title}
          </Link>
        </h3>
        {product.ratingCount > 0 ? (
          <span className="flex items-center gap-1 text-xs text-ink-muted">
            <StarIcon />
            {toPersianDigits(product.ratingAverage.toFixed(1))}
            <span>({toPersianDigits(product.ratingCount)})</span>
          </span>
        ) : null}
        <div className="mt-auto pt-1">
          {product.inStock ? (
            <Price
              amount={product.price}
              compareAt={product.compareAtPrice}
              discountPercent={product.discountPercent}
              size="sm"
            />
          ) : (
            <span className="text-sm text-ink-muted">{t.catalog.outOfStock}</span>
          )}
        </div>
      </div>
    </article>
  );
}

function StarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-3.5 fill-amber-400">
      <path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 14.9l-5.2 2.8 1-5.9L1.5 7.7l5.9-.8z" />
    </svg>
  );
}
