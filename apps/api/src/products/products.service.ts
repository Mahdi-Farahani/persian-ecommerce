import { Injectable } from '@nestjs/common';
import {
  buildPagination,
  PUBLIC_PRODUCT_STATUSES,
  type Paginated,
  type ProductCard,
  type ProductDetail,
} from '@pe/shared';
import { CategoriesService } from '../categories/categories.service.js';
import { NotFoundAppException } from '../common/errors/app.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SearchService } from '../search/search.service.js';
import type { ProductListQueryDto } from './dto/product.dto.js';
import { buildProductFilters, PRODUCT_ORDER_BY } from './product-filters.js';
import {
  productCardInclude,
  productDetailInclude,
  toProductCard,
  toProductDetail,
} from './products.mapper.js';

/**
 * Customer-facing catalogue reads. Free-text queries are delegated to
 * SearchService so `/products?q=` and `/search` rank identically.
 */
@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
    private readonly search: SearchService,
  ) {}

  async list(query: ProductListQueryDto): Promise<Paginated<ProductCard>> {
    if (query.q && query.q.trim().length > 0) return this.search.search(query);
    const where = await buildProductFilters(query, this.categories);
    if (where === null) {
      return { items: [], pagination: buildPagination(query.page, query.limit, 0) };
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: productCardInclude,
        orderBy: PRODUCT_ORDER_BY[query.sort ?? 'newest'],
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
}
