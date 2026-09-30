import { ProductSortOptions, type ProductListFilters, type ProductSort } from '@pe/shared';

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

/** Page size shared by every storefront listing. */
export const LISTING_PAGE_SIZE = 24;

/** Longest query the search API accepts; longer input is truncated, not rejected. */
export const SEARCH_QUERY_MAX_LENGTH = 100;

const ATTR_PARAM = /^attr\[(.+)\]$/;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isProductSort(value: string | undefined): value is ProductSort {
  return value !== undefined && (ProductSortOptions as readonly string[]).includes(value);
}

/** Trims and truncates the free-text query; empty input yields undefined. */
export function normalizeSearchQuery(value: string | string[] | undefined): string | undefined {
  const trimmed = firstValue(value)?.trim() ?? '';
  if (!trimmed) return undefined;
  return trimmed.slice(0, SEARCH_QUERY_MAX_LENGTH);
}

export interface ParseListFiltersOptions {
  /** Sort used when the URL carries none; defaults to relevance for queries, newest otherwise. */
  defaultSort?: ProductSort;
}

/** Reads listing filters from Next.js search params. */
export function parseListFilters(
  searchParams: SearchParamsRecord,
  options: ParseListFiltersOptions = {},
): ProductListFilters {
  const first = (key: string) => firstValue(searchParams[key]);
  const attr: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    const match = ATTR_PARAM.exec(key);
    if (match?.[1] && value) attr[match[1]] = Array.isArray(value) ? value.join(',') : value;
  }
  const page = Number(first('page') ?? 1);
  const sort = first('sort');
  const q = normalizeSearchQuery(searchParams['q']);
  const fallbackSort = options.defaultSort ?? (q ? 'relevance' : 'newest');
  return {
    brand: first('brand'),
    minPrice: first('minPrice') ? Number(first('minPrice')) : undefined,
    maxPrice: first('maxPrice') ? Number(first('maxPrice')) : undefined,
    inStock: first('inStock') === 'true',
    attr: Object.keys(attr).length ? attr : undefined,
    sort: isProductSort(sort) ? sort : fallbackSort,
    q,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit: LISTING_PAGE_SIZE,
  };
}

/**
 * Builds a page link under `basePath` that keeps every current search param
 * (including `q`, filters and sort) and only swaps the page number.
 */
export function listingPageHref(basePath: string, searchParams: SearchParamsRecord) {
  return (page: number): string => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === 'page' || value === undefined) continue;
      next.set(key, Array.isArray(value) ? value.join(',') : value);
    }
    if (page > 1) next.set('page', String(page));
    const qs = next.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
}

/** Link to the search results page for a query. */
export function searchHref(query: string): string {
  const q = normalizeSearchQuery(query);
  return q ? `/search?q=${encodeURIComponent(q)}` : '/search';
}

/** True when any narrowing filter (beyond the query, sort and page) is active. */
export function hasActiveFilters(searchParams: SearchParamsRecord): boolean {
  return Object.entries(searchParams).some(
    ([key, value]) => !['q', 'sort', 'page', 'limit'].includes(key) && value !== undefined,
  );
}
