import type { ProductCard as ProductCardData } from '@pe/shared';
import { t } from '@/i18n';
import { ProductCard } from './product-card';

export function ProductGrid({
  products,
  emptyMessage,
}: {
  products: ProductCardData[];
  emptyMessage?: string;
}) {
  if (products.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-border bg-surface p-10 text-center text-sm text-ink-muted">
        {emptyMessage ?? t.catalog.empty}
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
