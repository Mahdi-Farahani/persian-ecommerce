import { Injectable } from '@nestjs/common';
import {
  buildPagination,
  normalizePersian,
  PUBLIC_PRODUCT_STATUSES,
  type Paginated,
  type ProductCard,
  type ProductDetail,
  type ProductSort,
} from '@pe/shared';
import { CategoriesService } from '../categories/categories.service.js';
import { NotFoundAppException } from '../common/errors/app.exception.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ProductListQueryDto } from './dto/product.dto.js';
import {
  productCardInclude,
  productDetailInclude,
  toProductCard,
  toProductDetail,
} from './products.mapper.js';

const ORDER_BY: Record<ProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  newest: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
  price_asc: [{ minPrice: 'asc' }, { createdAt: 'desc' }],
  price_desc: [{ minPrice: 'desc' }, { createdAt: 'desc' }],
  popular: [{ ratingCount: 'desc' }, { createdAt: 'desc' }],
  rating: [{ ratingAverage: 'desc' }, { ratingCount: 'desc' }],
};

/**
 * Customer-facing catalogue reads. Search is intentionally simple here (LIKE
 * on normalised titles); the dedicated search service refines it.
 */
@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
  ) {}

  async list(query: ProductListQueryDto): Promise<Paginated<ProductCard>> {
    const where = await this.buildWhere(query);
    if (where === null) {
      return { items: [], pagination: buildPagination(query.page, query.limit, 0) };
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: productCardInclude,
        orderBy: ORDER_BY[query.sort ?? 'newest'],
        skip: query.skip,
        take: query.limit,
      }),
    ]);
    return {
      items: rows.map(toProductCard),
      pagination: buildPagination(query.page, query.limit, total),
    };
  }

  async getBySlug(slug: string): Promise<ProductDetail> {
    const row = await this.prisma.product.findFirst({
      where: { slug, status: { in: [...PUBLIC_PRODUCT_STATUSES] } },
      include: productDetailInclude,
    });
    if (!row) throw new NotFoundAppException('PRODUCT_NOT_FOUND', 'محصول پیدا نشد');
    const breadcrumb = await this.categories.breadcrumbFor(row.category);
    return toProductDetail(row, breadcrumb);
  }

  /** Lightweight cards for a set of product ids (wishlist, related items). */
  async cardsByIds(ids: string[]): Promise<ProductCard[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.product.findMany({
      where: { id: { in: ids }, status: { in: [...PUBLIC_PRODUCT_STATUSES] } },
      include: productCardInclude,
    });
    const byId = new Map(rows.map((r) => [r.id, toProductCard(r)]));
    return ids.map((id) => byId.get(id)).filter((c): c is ProductCard => Boolean(c));
  }

  /** Returns null when a filter can never match (e.g. unknown category). */
  private async buildWhere(query: ProductListQueryDto): Promise<Prisma.ProductWhereInput | null> {
    const where: Prisma.ProductWhereInput = { status: { in: [...PUBLIC_PRODUCT_STATUSES] } };
    const and: Prisma.ProductWhereInput[] = [];

    if (query.category) {
      const category = await this.categories.findActiveBySlug(query.category);
      if (!category) return null;
      where.categoryId = { in: await this.categories.subtreeIds(category.id) };
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
    if (query.q) {
      const term = normalizePersian(query.q);
      and.push({
        OR: [
          { title: { contains: term } },
          { titleEn: { contains: term } },
          { brand: { name: { contains: term } } },
        ],
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
}
