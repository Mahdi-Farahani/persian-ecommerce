import type {
  BrandSummary,
  FilterableAttribute,
  Paginated,
  ProductCard,
  ProductListFilters,
} from '@pe/shared';
import { formatPersianNumber } from '@pe/shared';
import { Pagination } from '@/components/ui/pagination';
import { t } from '@/i18n';
import { FilterSidebar } from './filter-sidebar';
import { ProductGrid } from './product-grid';
import { SortSelect } from './sort-select';

interface ProductListingProps {
  result: Paginated<ProductCard>;
  brands: BrandSummary[];
  attributes: FilterableAttribute[];
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
  title?: string;
}

/** Reads listing filters from Next.js search params. */
export function parseListFilters(
  searchParams: Record<string, string | string[] | undefined>,
): ProductListFilters {
  const first = (key: string): string | undefined => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const attr: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    const match = /^attr\[(.+)\]$/.exec(key);
    if (match?.[1] && value) attr[match[1]] = Array.isArray(value) ? value.join(',') : value;
  }
  const page = Number(first('page') ?? 1);
  const sort = first('sort');
  return {
    brand: first('brand'),
    minPrice: first('minPrice') ? Number(first('minPrice')) : undefined,
    maxPrice: first('maxPrice') ? Number(first('maxPrice')) : undefined,
    inStock: first('inStock') === 'true',
    attr: Object.keys(attr).length ? attr : undefined,
    sort:
      sort && ['newest', 'price_asc', 'price_desc', 'popular', 'rating'].includes(sort)
        ? (sort as ProductListFilters['sort'])
        : 'newest',
    q: first('q'),
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit: 24,
  };
}

export function ProductListing({
  result,
  brands,
  attributes,
  basePath,
  searchParams,
  title,
}: ProductListingProps) {
  const hrefFor = (page: number): string => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === 'page' || value === undefined) continue;
      next.set(key, Array.isArray(value) ? value.join(',') : value);
    }
    if (page > 1) next.set('page', String(page));
    const qs = next.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

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
          <SortSelect />
        </div>
        <ProductGrid products={result.items} />
        <div className="mt-8">
          <Pagination pagination={result.pagination} hrefFor={hrefFor} />
        </div>
      </section>
    </div>
  );
}
