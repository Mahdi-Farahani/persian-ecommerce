import { PUBLIC_PRODUCT_STATUSES, type ProductSort } from '@pe/shared';
import type { CategoriesService } from '../categories/categories.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { ProductListQueryDto } from './dto/product.dto.js';

export const PRODUCT_ORDER_BY: Record<ProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  // Relevance only exists for text search; plain listings fall back to newest.
  relevance: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
  newest: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
  price_asc: [{ minPrice: 'asc' }, { createdAt: 'desc' }],
  price_desc: [{ minPrice: 'desc' }, { createdAt: 'desc' }],
  popular: [{ ratingCount: 'desc' }, { createdAt: 'desc' }],
  rating: [{ ratingAverage: 'desc' }, { ratingCount: 'desc' }],
};

/**
 * Structural filters shared by the catalogue listing and the search engine
 * (category subtree, brands, price range, availability, attributes). The free
 * text `q` is handled by SearchService. Returns null when a filter can never
 * match (unknown category).
 */
export async function buildProductFilters(
  query: Pick<
    ProductListQueryDto,
    'category' | 'brand' | 'minPrice' | 'maxPrice' | 'inStock' | 'attr'
  >,
  categories: Pick<CategoriesService, 'findActiveBySlug' | 'subtreeIds'>,
): Promise<Prisma.ProductWhereInput | null> {
  const where: Prisma.ProductWhereInput = { status: { in: [...PUBLIC_PRODUCT_STATUSES] } };
  const and: Prisma.ProductWhereInput[] = [];

  if (query.category) {
    const category = await categories.findActiveBySlug(query.category);
    if (!category) return null;
    where.categoryId = { in: await categories.subtreeIds(category.id) };
  }
  if (query.brand && query.brand.length > 0) {
    where.brand = { slug: { in: query.brand }, isActive: true };
  }
  if (query.minPrice !== undefined) and.push({ maxPrice: { gte: BigInt(query.minPrice) } });
  if (query.maxPrice !== undefined) and.push({ minPrice: { lte: BigInt(query.maxPrice) } });
  if (query.inStock) {
    and.push({
      variants: { some: { status: 'ACTIVE', inventory: { is: { stockQuantity: { gt: 0 } } } } },
    });
  }
  if (query.attr) {
    for (const [attributeSlug, raw] of Object.entries(query.attr)) {
      const values = (Array.isArray(raw) ? raw : String(raw).split(','))
        .map((v) => v.trim())
        .filter(Boolean);
      if (values.length === 0) continue;
      // Match either informational product attributes or variant-defining values.
      and.push({
        OR: [
          {
            attributes: {
              some: { attribute: { slug: attributeSlug }, value: { slug: { in: values } } },
            },
          },
          {
            variants: {
              some: {
                status: 'ACTIVE',
                attributeValues: {
                  some: { attribute: { slug: attributeSlug }, value: { slug: { in: values } } },
                },
              },
            },
          },
        ],
      });
    }
  }
  if (and.length > 0) where.AND = and;
  return where;
}
