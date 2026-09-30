import path from 'node:path';
import sharp from 'sharp';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { reindexAllProducts } from '../../search/search-index.js';
import { LocalStorageProvider } from '../../storage/local-storage.provider.js';
import {
  SEED_ATTRIBUTES,
  SEED_BRANDS,
  SEED_CATEGORIES,
  SEED_PRODUCTS,
  type SeedCategory,
  type SeedProduct,
} from './catalog-data.js';

export interface CatalogSeedSummary {
  brands: number;
  categories: number;
  attributes: number;
  products: number;
}

/**
 * Seeds brands, categories, attributes and sample products. Idempotent:
 * records are upserted by slug/SKU and stock is only set for new variants.
 */
export async function seedCatalog(
  prisma: PrismaClient,
  uploadsDir: string,
): Promise<CatalogSeedSummary> {
  const storage = new LocalStorageProvider(uploadsDir, '/uploads');

  // --- brands ---------------------------------------------------------------
  const brandIds = new Map<string, string>();
  for (const [index, brand] of SEED_BRANDS.entries()) {
    const row = await prisma.brand.upsert({
      where: { slug: brand.slug },
      update: { name: brand.name, nameEn: brand.nameEn, sortOrder: index },
      create: { ...brand, sortOrder: index, isActive: true },
      select: { id: true },
    });
    brandIds.set(brand.slug, row.id);
  }

  // --- attributes -----------------------------------------------------------
  const attributeIds = new Map<string, string>();
  const valueIds = new Map<string, string>(); // `${attrSlug}:${valueSlug}`
  for (const [index, attribute] of SEED_ATTRIBUTES.entries()) {
    const row = await prisma.attribute.upsert({
      where: { slug: attribute.slug },
      update: {
        name: attribute.name,
        type: attribute.type ?? 'SELECT',
        unit: attribute.unit,
        isVariant: attribute.isVariant ?? false,
        isFilterable: attribute.isFilterable ?? true,
        sortOrder: index,
      },
      create: {
        name: attribute.name,
        slug: attribute.slug,
        type: attribute.type ?? 'SELECT',
        unit: attribute.unit,
        isVariant: attribute.isVariant ?? false,
        isFilterable: attribute.isFilterable ?? true,
        sortOrder: index,
      },
      select: { id: true },
    });
    attributeIds.set(attribute.slug, row.id);
    for (const [vIndex, value] of (attribute.values ?? []).entries()) {
      const v = await prisma.attributeValue.upsert({
        where: { attributeId_slug: { attributeId: row.id, slug: value.slug } },
        update: { value: value.value, colorHex: value.colorHex, sortOrder: vIndex },
        create: {
          attributeId: row.id,
          value: value.value,
          slug: value.slug,
          colorHex: value.colorHex,
          sortOrder: vIndex,
        },
        select: { id: true },
      });
      valueIds.set(`${attribute.slug}:${value.slug}`, v.id);
    }
  }

  // --- categories -----------------------------------------------------------
  const categoryIds = new Map<string, string>();
  let categoryCount = 0;
  const upsertCategory = async (
    category: SeedCategory,
    parent: { id: string; path: string; depth: number } | null,
    index: number,
  ): Promise<void> => {
    const pathValue = parent ? `${parent.path}${parent.id}/` : '/';
    const depth = parent ? parent.depth + 1 : 0;
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        parentId: parent?.id ?? null,
        path: pathValue,
        depth,
        sortOrder: index,
        isActive: true,
      },
      create: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        parentId: parent?.id ?? null,
        path: pathValue,
        depth,
        sortOrder: index,
        isActive: true,
      },
      select: { id: true },
    });
    categoryIds.set(category.slug, row.id);
    categoryCount += 1;
    for (const [aIndex, attributeSlug] of (category.attributes ?? []).entries()) {
      const attributeId = attributeIds.get(attributeSlug);
      if (!attributeId) continue;
      await prisma.categoryAttribute.upsert({
        where: { categoryId_attributeId: { categoryId: row.id, attributeId } },
        update: { sortOrder: aIndex },
        create: { categoryId: row.id, attributeId, sortOrder: aIndex },
      });
    }
    for (const [cIndex, child] of (category.children ?? []).entries()) {
      await upsertCategory(child, { id: row.id, path: pathValue, depth }, cIndex);
    }
  };
  for (const [index, category] of SEED_CATEGORIES.entries()) {
    await upsertCategory(category, null, index);
  }

  // --- products -------------------------------------------------------------
  for (const product of SEED_PRODUCTS) {
    await upsertProduct(prisma, storage, product, {
      brandIds,
      categoryIds,
      attributeIds,
      valueIds,
    });
  }

  await reindexAllProducts(prisma);

  return {
    brands: SEED_BRANDS.length,
    categories: categoryCount,
    attributes: SEED_ATTRIBUTES.length,
    products: SEED_PRODUCTS.length,
  };
}

interface Lookups {
  brandIds: Map<string, string>;
  categoryIds: Map<string, string>;
  attributeIds: Map<string, string>;
  valueIds: Map<string, string>;
}

async function upsertProduct(
  prisma: PrismaClient,
  storage: LocalStorageProvider,
  product: SeedProduct,
  lookups: Lookups,
): Promise<void> {
  const categoryId = lookups.categoryIds.get(product.category);
  if (!categoryId) throw new Error(`Seed category missing: ${product.category}`);
  const brandId = product.brand ? lookups.brandIds.get(product.brand) : undefined;
  const status = product.status ?? 'ACTIVE';

  const row = await prisma.product.upsert({
    where: { slug: product.slug },
    update: {
      title: product.title,
      titleEn: product.titleEn,
      categoryId,
      brandId: brandId ?? null,
      shortDescription: product.shortDescription,
      description: product.description,
      status,
      weightGrams: product.weightGrams,
    },
    create: {
      title: product.title,
      titleEn: product.titleEn,
      slug: product.slug,
      categoryId,
      brandId: brandId ?? null,
      shortDescription: product.shortDescription,
      description: product.description,
      status,
      weightGrams: product.weightGrams,
      publishedAt: status === 'ACTIVE' ? new Date() : null,
    },
    select: { id: true },
  });

  // Informational attributes
  await prisma.productAttributeValue.deleteMany({ where: { productId: row.id } });
  for (const [attrSlug, raw] of Object.entries(product.attributes ?? {})) {
    const attributeId = lookups.attributeIds.get(attrSlug);
    if (!attributeId) continue;
    const valueId = lookups.valueIds.get(`${attrSlug}:${raw}`);
    await prisma.productAttributeValue.create({
      data: {
        productId: row.id,
        attributeId,
        valueId: valueId ?? null,
        valueText: valueId ? null : raw,
      },
    });
  }

  // Specifications
  await prisma.productSpecification.deleteMany({ where: { productId: row.id } });
  if (product.specifications?.length) {
    await prisma.productSpecification.createMany({
      data: product.specifications.map((s, index) => ({
        productId: row.id,
        group: s.group,
        name: s.name,
        value: s.value,
        sortOrder: index,
      })),
    });
  }

  // Variants
  for (const [index, variant] of product.variants.entries()) {
    const existing = await prisma.productVariant.findUnique({
      where: { sku: variant.sku },
      select: { id: true },
    });
    const data = {
      productId: row.id,
      title: variant.title,
      price: BigInt(variant.price),
      compareAtPrice: variant.compareAtPrice === undefined ? null : BigInt(variant.compareAtPrice),
      status: variant.status ?? 'ACTIVE',
      isDefault: index === 0,
      sortOrder: index,
    };
    const v = existing
      ? await prisma.productVariant.update({
          where: { id: existing.id },
          data,
          select: { id: true },
        })
      : await prisma.productVariant.create({
          data: { ...data, sku: variant.sku },
          select: { id: true },
        });

    await prisma.variantAttributeValue.deleteMany({ where: { variantId: v.id } });
    for (const [attrSlug, valueSlug] of Object.entries(variant.attributes ?? {})) {
      const attributeId = lookups.attributeIds.get(attrSlug);
      const valueId = lookups.valueIds.get(`${attrSlug}:${valueSlug}`);
      if (attributeId && valueId) {
        await prisma.variantAttributeValue.create({
          data: { variantId: v.id, attributeId, valueId },
        });
      }
    }

    if (!existing) {
      await prisma.inventory.create({
        data: {
          variantId: v.id,
          stockQuantity: variant.stock,
          reservedQuantity: 0,
          lowStockThreshold: 3,
        },
      });
      if (variant.stock > 0) {
        await prisma.inventoryTransaction.create({
          data: {
            variantId: v.id,
            type: 'PURCHASE',
            quantity: variant.stock,
            stockAfter: variant.stock,
            reservedAfter: 0,
            note: 'موجودی اولیه (seed)',
          },
        });
      }
    }
  }

  // Price range
  const agg = await prisma.productVariant.aggregate({
    where: { productId: row.id, status: 'ACTIVE' },
    _min: { price: true },
    _max: { price: true },
  });
  await prisma.product.update({
    where: { id: row.id },
    data: { minPrice: agg._min.price, maxPrice: agg._max.price },
  });

  // Images: generated placeholders (deterministic key per product)
  const imageCount = await prisma.productImage.count({ where: { productId: row.id } });
  if (imageCount === 0) {
    const urls: string[] = [];
    for (const n of [1, 2]) {
      const key = `seed/${product.slug}-${n}.webp`;
      const buffer = await renderPlaceholder(
        product.titleEn ?? product.slug,
        product.imageColor,
        n,
      );
      const stored = await storage.put(key, buffer, 'image/webp');
      urls.push(stored.url);
    }
    await prisma.productImage.createMany({
      data: urls.map((url, index) => ({
        productId: row.id,
        url,
        alt: product.title,
        sortOrder: index,
        isPrimary: index === 0,
      })),
    });
  }
}

/** Renders a simple branded placeholder so the storefront has real image files. */
async function renderPlaceholder(label: string, color: string, index: number): Promise<Buffer> {
  const safe = label.replace(/[<>&"']/g, '');
  const shade = index === 1 ? color : `${color}cc`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
    <rect width="800" height="800" fill="${shade}"/>
    <circle cx="400" cy="360" r="170" fill="#ffffff" fill-opacity="0.18"/>
    <text x="400" y="640" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="700" fill="#ffffff" text-anchor="middle">${safe}</text>
    <text x="400" y="700" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#ffffff" fill-opacity="0.8" text-anchor="middle">sample image ${index}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer();
}

export function defaultUploadsDir(): string {
  return path.resolve(process.cwd(), process.env['UPLOADS_DIR'] ?? 'uploads');
}
