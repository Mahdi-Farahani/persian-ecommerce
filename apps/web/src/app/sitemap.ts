import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { getBrands, getCategoryTree, listProducts } from '@/lib/catalog/api';
import type { CategoryNode, ProductCard } from '@pe/shared';

// Generated per request (crawlers fetch it rarely); a build-time snapshot
// would freeze the catalogue and needs the API during `next build`.
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;
/** Upper bound so a runaway catalogue cannot make the sitemap unbounded. */
const MAX_PRODUCT_PAGES = 50;

function flatten(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children ?? [])]);
}

async function allProducts(): Promise<ProductCard[]> {
  const items: ProductCard[] = [];
  for (let page = 1; page <= MAX_PRODUCT_PAGES; page += 1) {
    const result = await listProducts({ page, limit: PAGE_SIZE, sort: 'newest' });
    items.push(...result.items);
    if (page >= result.pagination.totalPages) break;
  }
  return items;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.appUrl.replace(/\/+$/, '');
  const now = new Date();
  const [categories, brands, products] = await Promise.all([
    getCategoryTree().catch(() => [] as CategoryNode[]),
    getBrands().catch(() => []),
    allProducts().catch(() => [] as ProductCard[]),
  ]);
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/products`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/categories`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    ...['about', 'contact', 'terms', 'privacy', 'faq'].map((slug) => ({
      url: `${base}/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    })),
    ...flatten(categories).map((category) => ({
      url: `${base}/categories/${category.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
    ...brands.map((brand) => ({
      url: `${base}/brands/${brand.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
    ...products.map((product) => ({
      url: `${base}/products/${product.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ];
}
