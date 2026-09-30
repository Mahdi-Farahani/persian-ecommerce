import type {
  BrandSummary,
  FilterableAttribute,
  Paginated,
  ProductCard,
  ProductSort,
} from '@pe/shared';
import { formatPersianNumber } from '@pe/shared';
import type { ReactNode } from 'react';
import { Pagination } from '@/components/ui/pagination';
import { t } from '@/i18n';
import { listingPageHref, type SearchParamsRecord } from '@/lib/catalog/listing';
import { FilterSidebar } from './filter-sidebar';
import { ProductGrid } from './product-grid';
import { SortSelect } from './sort-select';

export { parseListFilters } from '@/lib/catalog/listing';

interface ProductListingProps {
  result: Paginated<ProductCard>;
  brands: BrandSummary[];
  attributes: FilterableAttribute[];
  /** Path the filter, sort and pagination links are built under. */
  basePath: string;
  searchParams: SearchParamsRecord;
  title?: string;
  /** Sort shown as selected when the URL carries none. */
  defaultSort?: ProductSort;
  /** Rendered in place of the grid when there are no results. */
  empty?: ReactNode;
}

export function ProductListing({
  result,
  brands,
  attributes,
  basePath,
  searchParams,
  title,
  defaultSort,
  empty,
}: ProductListingProps) {
  const hrefFor = listingPageHref(basePath, searchParams);
  const isEmpty = result.items.length === 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <FilterSidebar brands={brands} attributes={attributes} />
      <section className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            {title ? <h1 className="text-xl font-bold">{title}</h1> : null}
            <p className="text-sm text-ink-muted">
              {t.catalog.resultsCount(formatPersianNumber(result.pagination.total))}
            </p>
          </div>
          <SortSelect defaultSort={defaultSort} />
        </div>
        {isEmpty && empty ? empty : <ProductGrid products={result.items} />}
        <div className="mt-8">
          <Pagination pagination={result.pagination} hrefFor={hrefFor} />
        </div>
      </section>
    </div>
  );
}
