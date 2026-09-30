import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { buildSearchText } from './search-text.js';

type Db = PrismaClient | Prisma.TransactionClient;

const indexInclude = {
  brand: { select: { name: true } },
  category: { select: { name: true } },
  variants: { select: { sku: true } },
  attributes: { select: { value: { select: { value: true } }, valueText: true } },
} satisfies Prisma.ProductInclude;

type IndexRow = Prisma.ProductGetPayload<{ include: typeof indexInclude }>;

function textFor(row: IndexRow): string {
  return buildSearchText({
    title: row.title,
    titleEn: row.titleEn,
    shortDescription: row.shortDescription,
    brandName: row.brand?.name ?? null,
    categoryName: row.category.name,
    skus: row.variants.map((v) => v.sku),
    attributeValues: row.attributes
      .map((a) => a.value?.value ?? a.valueText ?? '')
      .filter((v) => v.length > 0),
  });
}

/** Recomputes `products.searchText` for one product (no-op when it does not exist). */
export async function reindexProduct(db: Db, productId: string): Promise<void> {
  const row = await db.product.findUnique({ where: { id: productId }, include: indexInclude });
  if (!row) return;
  await db.product.update({ where: { id: productId }, data: { searchText: textFor(row) } });
}

/** Recomputes the search text for every product in batches; returns the count. */
export async function reindexAllProducts(db: Db, batchSize = 200): Promise<number> {
  let cursor: string | undefined;
  let count = 0;
  for (;;) {
    const rows = await db.product.findMany({
      include: indexInclude,
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (rows.length === 0) break;
    for (const row of rows) {
      await db.product.update({ where: { id: row.id }, data: { searchText: textFor(row) } });
      count += 1;
    }
    cursor = rows[rows.length - 1]!.id;
    if (rows.length < batchSize) break;
  }
  return count;
}
