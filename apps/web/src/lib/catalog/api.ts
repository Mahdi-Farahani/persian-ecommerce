import 'server-only';
import type {
  BrandDetail,
  BrandSummary,
  CategoryDetail,
  CategoryNode,
  Paginated,
  ProductCard,
  ProductDetail,
  ProductListFilters,
} from '@pe/shared';
import { ApiError } from '@/lib/api/errors';
import { publicApi } from '@/lib/api/server';
import type { QueryValue } from '@/lib/api/client';

const CATALOG_REVALIDATE_SECONDS = 60;

/** Server-side catalogue reads with short-lived caching (public data only). */
export async function getCategoryTree(): Promise<CategoryNode[]> {
  try {
    return await publicApi<CategoryNode[]>('/categories', {
      next: { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ['categories'] },
    });
  } catch {
    // Navigation must never take the page down with it.
    return [];
  }
}

export async function getCategory(slug: string): Promise<CategoryDetail | null> {
  return nullOn404(
    publicApi<CategoryDetail>(`/categories/${encodeURIComponent(slug)}`, {
      next: { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ['categories'] },
    }),
  );
}

export async function getBrands(): Promise<BrandSummary[]> {
  try {
    return await publicApi<BrandSummary[]>('/brands', {
      next: { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ['brands'] },
    });
  } catch {
    return [];
  }
}

export async function getBrand(slug: string): Promise<BrandDetail | null> {
  return nullOn404(
    publicApi<BrandDetail>(`/brands/${encodeURIComponent(slug)}`, {
      next: { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ['brands'] },
    }),
  );
}

/** Serialises listing filters into the query shape shared by `/products` and `/search`. */
function listQuery(filters: ProductListFilters): Record<string, QueryValue> {
  const query: Record<string, QueryValue> = {
    category: filters.category,
    brand: Array.isArray(filters.brand) ? filters.brand.join(',') : filters.brand,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    inStock: filters.inStock ? 'true' : undefined,
    sort: filters.sort,
    q: filters.q,
    page: filters.page,
    limit: filters.limit,
  };
  for (const [slug, value] of Object.entries(filters.attr ?? {})) {
    query[`attr[${slug}]`] = Array.isArray(value) ? value.join(',') : value;
  }
  return query;
}

export async function listProducts(filters: ProductListFilters): Promise<Paginated<ProductCard>> {
  return publicApi<Paginated<ProductCard>>('/products', {
    query: listQuery(filters),
    next: { revalidate: 30, tags: ['products'] },
  });
}

/** Full-text search; same filters and result shape as the product listing. */
export async function searchProducts(filters: ProductListFilters): Promise<Paginated<ProductCard>> {
  return publicApi<Paginated<ProductCard>>('/search', {
    query: listQuery(filters),
    next: { revalidate: 30, tags: ['products'] },
  });
}

export async function getProduct(slug: string): Promise<ProductDetail | null> {
  return nullOn404(
    publicApi<ProductDetail>(`/products/${encodeURIComponent(slug)}`, {
      next: { revalidate: 30, tags: ['products', `product:${slug}`] },
    }),
  );
}

async function nullOn404<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) return null;
    throw error;
  }
}
