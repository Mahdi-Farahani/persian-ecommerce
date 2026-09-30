import { Injectable, Logger } from '@nestjs/common';
import {
  buildPagination,
  normalizePersian,
  PUBLIC_PRODUCT_STATUSES,
  SEARCH_SUGGEST_LIMIT,
  SEARCH_SUGGEST_MIN_LENGTH,
  type Paginated,
  type ProductCard,
  type SearchSuggestions,
} from '@pe/shared';
import { CategoriesService } from '../categories/categories.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ProductListQueryDto } from '../products/dto/product.dto.js';
import { buildProductFilters, PRODUCT_ORDER_BY } from '../products/product-filters.js';
import { productCardInclude, toProductCard } from '../products/products.mapper.js';
import { reindexAllProducts, reindexProduct } from './search-index.js';
import { booleanQuery, relaxedQuery, shortTokens, tokenize } from './search-text.js';

/** Upper bound on candidate ids pulled from the fulltext index per query. */
const MAX_CANDIDATES = 2000;

interface Candidate {
  id: string;
  score: number;
}

/**
 * Product discovery on top of the MariaDB FULLTEXT index over
 * `products.searchText` (normalised Persian/English text). Controllers and
 * the catalogue listing depend on this service, never on the SQL, so the
 * engine can be swapped for a dedicated search backend later.
 *
 * Matching strategy per query:
 *  1. boolean mode, every token required as a prefix (partial words);
 *     tokens shorter than the index minimum are matched with LIKE;
 *  2. typo tolerance: shortened prefixes, any token (relaxed) when 1 is empty;
 *  3. LIKE on every token when the index cannot help at all.
 */
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
  ) {}

  async search(query: ProductListQueryDto): Promise<Paginated<ProductCard>> {
    const empty = { items: [], pagination: buildPagination(query.page, query.limit, 0) };
    const tokens = tokenize(query.q ?? '');
    const filters = await buildProductFilters(query, this.categories);
    if (!filters) return empty;
    if (tokens.length === 0) return this.plainList(filters, query);

    const candidates = await this.candidates(tokens);
    if (candidates.length === 0) return empty;
    const scoreOf = new Map(candidates.map((c) => [c.id, c.score]));
    const where: Prisma.ProductWhereInput = { ...filters, id: { in: [...scoreOf.keys()] } };

    const sort = query.sort ?? 'relevance';
    if (sort !== 'relevance') {
      const [total, rows] = await this.prisma.$transaction([
        this.prisma.product.count({ where }),
        this.prisma.product.findMany({
          where,
          include: productCardInclude,
          orderBy: PRODUCT_ORDER_BY[sort],
          skip: query.skip,
          take: query.limit,
        }),
      ]);
      return {
        items: rows.map(toProductCard),
        pagination: buildPagination(query.page, query.limit, total),
      };
    }

    // Relevance: order the filtered ids by score, then hydrate the page.
    const filtered = await this.prisma.product.findMany({ where, select: { id: true } });
    const ordered = filtered
      .map((r) => r.id)
      .sort((a, b) => (scoreOf.get(b) ?? 0) - (scoreOf.get(a) ?? 0));
    const pageIds = ordered.slice(query.skip, query.skip + query.limit);
    const rows = await this.prisma.product.findMany({
      where: { id: { in: pageIds } },
      include: productCardInclude,
    });
    const byId = new Map(rows.map((r) => [r.id, toProductCard(r)]));
    return {
      items: pageIds.map((id) => byId.get(id)).filter((c): c is ProductCard => Boolean(c)),
      pagination: buildPagination(query.page, query.limit, ordered.length),
    };
  }

  /** Header autocomplete: a few products, categories and brands. */
  async suggest(rawQuery: string): Promise<SearchSuggestions> {
    // Echoed back to the client; keep it free of markup-significant characters.
    const query = normalizePersian(rawQuery).replace(/[<>]/g, '').slice(0, 100);
    const tokens = tokenize(query);
    const result: SearchSuggestions = { query, products: [], categories: [], brands: [] };
    if (query.length < SEARCH_SUGGEST_MIN_LENGTH || tokens.length === 0) return result;

    const candidates = (await this.candidates(tokens, SEARCH_SUGGEST_LIMIT * 4)).slice(
      0,
      SEARCH_SUGGEST_LIMIT * 4,
    );
    const [products, categories, brands] = await Promise.all([
      candidates.length === 0
        ? Promise.resolve([])
        : this.prisma.product.findMany({
            where: {
              id: { in: candidates.map((c) => c.id) },
              status: { in: [...PUBLIC_PRODUCT_STATUSES] },
            },
            include: productCardInclude,
          }),
      this.prisma.category.findMany({
        where: { isActive: true, name: { contains: query } },
        select: { id: true, name: true, slug: true },
        orderBy: { depth: 'asc' },
        take: 4,
      }),
      this.prisma.brand.findMany({
        where: {
          isActive: true,
          OR: [{ name: { contains: query } }, { nameEn: { contains: query } }],
        },
        select: { id: true, name: true, slug: true },
        take: 4,
      }),
    ]);
    const scoreOf = new Map(candidates.map((c) => [c.id, c.score]));
    result.products = products
      .sort((a, b) => (scoreOf.get(b.id) ?? 0) - (scoreOf.get(a.id) ?? 0))
      .slice(0, SEARCH_SUGGEST_LIMIT)
      .map(toProductCard)
      .map((card) => ({
        id: card.id,
        title: card.title,
        slug: card.slug,
        image: card.image,
        price: card.price,
        compareAtPrice: card.compareAtPrice,
        inStock: card.inStock,
      }));
    result.categories = categories;
    result.brands = brands;
    return result;
  }

  reindex(productId: string): Promise<void> {
    return reindexProduct(this.prisma, productId);
  }

  async reindexAll(): Promise<number> {
    const count = await reindexAllProducts(this.prisma);
    this.logger.log({ message: 'search index rebuilt', products: count });
    return count;
  }

  // --- internals -----------------------------------------------------------------

  private async plainList(
    where: Prisma.ProductWhereInput,
    query: ProductListQueryDto,
  ): Promise<Paginated<ProductCard>> {
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

  /** Candidate product ids with a relevance score, best first. */
  private async candidates(tokens: string[], limit = MAX_CANDIDATES): Promise<Candidate[]> {
    const strict = booleanQuery(tokens);
    const likes = shortTokens(tokens);
    if (strict) {
      const rows = await this.fulltext(strict, likes, limit);
      if (rows.length > 0) return rows;
      const relaxed = relaxedQuery(tokens);
      if (relaxed && relaxed !== strict) {
        const tolerant = await this.fulltext(relaxed, [], limit);
        if (tolerant.length > 0) return tolerant;
      }
    }
    return this.likeOnly(tokens, limit);
  }

  private fulltext(expression: string, likes: string[], limit: number): Promise<Candidate[]> {
    const conditions = [
      Prisma.sql`MATCH(searchText) AGAINST (${expression} IN BOOLEAN MODE)`,
      ...likes.map((t) => Prisma.sql`searchText LIKE ${`%${t}%`}`),
    ];
    return this.prisma.$queryRaw<Candidate[]>(Prisma.sql`
      SELECT id, MATCH(searchText) AGAINST (${expression} IN BOOLEAN MODE) AS score
      FROM products
      WHERE ${Prisma.join(conditions, ' AND ')} AND status IN (${Prisma.join([...PUBLIC_PRODUCT_STATUSES])})
      ORDER BY score DESC, publishedAt DESC
      LIMIT ${limit}`);
  }

  private likeOnly(tokens: string[], limit: number): Promise<Candidate[]> {
    if (tokens.length === 0) return Promise.resolve([]);
    const conditions = tokens.map((t) => Prisma.sql`searchText LIKE ${`%${t}%`}`);
    return this.prisma.$queryRaw<Candidate[]>(Prisma.sql`
      SELECT id, 1 AS score FROM products
      WHERE ${Prisma.join(conditions, ' AND ')} AND status IN (${Prisma.join([...PUBLIC_PRODUCT_STATUSES])})
      ORDER BY publishedAt DESC
      LIMIT ${limit}`);
  }
}
