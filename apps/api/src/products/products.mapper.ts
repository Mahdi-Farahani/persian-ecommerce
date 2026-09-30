import type {
  AttributeValueSummary,
  ProductCard,
  ProductDetail,
  ProductImageSummary,
  VariantDetail,
} from '@pe/shared';
import { BrandsService } from '../brands/brands.service.js';
import { discountOf, money, moneyOrNull } from '../common/utils/money.util.js';
import type { Prisma } from '../generated/prisma/client.js';

export const productCardInclude = {
  brand: true,
  category: { select: { id: true, name: true, slug: true } },
  images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 },
  variants: {
    where: { status: 'ACTIVE' },
    orderBy: [{ price: 'asc' }],
    include: { inventory: true },
  },
} satisfies Prisma.ProductInclude;

export const productDetailInclude = {
  brand: true,
  category: { select: { id: true, name: true, slug: true, path: true } },
  images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
  variants: {
    orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
    include: {
      inventory: true,
      attributeValues: { include: { attribute: true, value: true } },
      images: { select: { id: true } },
    },
  },
  attributes: { include: { attribute: true, value: true } },
  specifications: { orderBy: [{ sortOrder: 'asc' }] },
} satisfies Prisma.ProductInclude;

export type ProductCardRow = Prisma.ProductGetPayload<{ include: typeof productCardInclude }>;
export type ProductDetailRow = Prisma.ProductGetPayload<{ include: typeof productDetailInclude }>;

type VariantWithInventory = {
  price: bigint;
  compareAtPrice: bigint | null;
  status: string;
  inventory: { stockQuantity: number; reservedQuantity: number } | null;
};

function availableOf(variant: VariantWithInventory): number {
  if (!variant.inventory) return 0;
  return Math.max(0, variant.inventory.stockQuantity - variant.inventory.reservedQuantity);
}

function toImage(image: {
  id: string;
  url: string;
  alt: string | null;
  sortOrder: number;
  isPrimary: boolean;
  variantId: string | null;
}): ProductImageSummary {
  return {
    id: image.id,
    url: image.url,
    alt: image.alt,
    sortOrder: image.sortOrder,
    isPrimary: image.isPrimary,
    variantId: image.variantId,
  };
}

/** Picks the variant customers see first: cheapest in-stock active variant, else cheapest active. */
function headlineVariant<T extends VariantWithInventory>(variants: T[]): T | undefined {
  const active = variants.filter((v) => v.status === 'ACTIVE');
  const sorted = [...active].sort((a, b) => Number(a.price - b.price));
  return sorted.find((v) => availableOf(v) > 0) ?? sorted[0];
}

export function toProductCard(row: ProductCardRow): ProductCard {
  const headline = headlineVariant(row.variants);
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    image: row.images[0] ? toImage(row.images[0]) : null,
    brand: row.brand ? BrandsService.toSummary(row.brand) : null,
    category: row.category,
    price: headline ? money(headline.price) : moneyOrNull(row.minPrice),
    compareAtPrice: headline ? moneyOrNull(headline.compareAtPrice) : null,
    discountPercent: headline ? discountOf(headline.compareAtPrice, headline.price) : 0,
    inStock: row.variants.some((v) => availableOf(v) > 0),
    ratingAverage: Number(row.ratingAverage),
    ratingCount: row.ratingCount,
    status: row.status,
  };
}

export function toVariantDetail(variant: ProductDetailRow['variants'][number]): VariantDetail {
  const available = availableOf(variant);
  const threshold = variant.inventory?.lowStockThreshold ?? 0;
  return {
    id: variant.id,
    sku: variant.sku,
    barcode: variant.barcode,
    title: variant.title,
    price: money(variant.price),
    compareAtPrice: moneyOrNull(variant.compareAtPrice),
    discountPercent: discountOf(variant.compareAtPrice, variant.price),
    status: variant.status,
    isDefault: variant.isDefault,
    weightGrams: variant.weightGrams,
    attributes: variant.attributeValues.map((av) => ({
      attributeId: av.attributeId,
      attributeName: av.attribute.name,
      attributeSlug: av.attribute.slug,
      valueId: av.valueId,
      value: av.value.value,
      valueSlug: av.value.slug,
      colorHex: av.value.colorHex,
    })),
    availableQuantity: available,
    inStock: variant.status === 'ACTIVE' && available > 0,
    lowStock: available > 0 && available <= threshold,
    imageIds: variant.images.map((i) => i.id),
  };
}

export function toProductDetail(
  row: ProductDetailRow,
  breadcrumb: ProductDetail['breadcrumb'],
  options: { includeInactiveVariants?: boolean } = {},
): ProductDetail {
  const variants = row.variants
    .filter((v) => options.includeInactiveVariants || v.status === 'ACTIVE')
    .map(toVariantDetail);
  const headline = headlineVariant(row.variants);

  // Variant-defining attributes and the values used across this product's variants.
  const variantAttributes = new Map<
    string,
    {
      id: string;
      name: string;
      slug: string;
      sortOrder: number;
      values: Map<string, AttributeValueSummary>;
    }
  >();
  for (const variant of row.variants) {
    if (variant.status !== 'ACTIVE' && !options.includeInactiveVariants) continue;
    for (const av of variant.attributeValues) {
      const entry = variantAttributes.get(av.attributeId) ?? {
        id: av.attributeId,
        name: av.attribute.name,
        slug: av.attribute.slug,
        sortOrder: av.attribute.sortOrder,
        values: new Map(),
      };
      entry.values.set(av.valueId, {
        id: av.valueId,
        value: av.value.value,
        slug: av.value.slug,
        colorHex: av.value.colorHex,
        sortOrder: av.value.sortOrder,
      });
      variantAttributes.set(av.attributeId, entry);
    }
  }

  return {
    id: row.id,
    title: row.title,
    titleEn: row.titleEn,
    slug: row.slug,
    brand: row.brand ? BrandsService.toSummary(row.brand) : null,
    category: { id: row.category.id, name: row.category.name, slug: row.category.slug },
    price: headline ? money(headline.price) : moneyOrNull(row.minPrice),
    compareAtPrice: headline ? moneyOrNull(headline.compareAtPrice) : null,
    discountPercent: headline ? discountOf(headline.compareAtPrice, headline.price) : 0,
    inStock: row.variants.some((v) => v.status === 'ACTIVE' && availableOf(v) > 0),
    ratingAverage: Number(row.ratingAverage),
    ratingCount: row.ratingCount,
    status: row.status,
    description: row.description,
    shortDescription: row.shortDescription,
    images: row.images.map(toImage),
    variants,
    variantAttributes: [...variantAttributes.values()]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((a) => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
        values: [...a.values.values()].sort(
          (x, y) => x.sortOrder - y.sortOrder || x.value.localeCompare(y.value, 'fa'),
        ),
      })),
    attributes: row.attributes
      .map((pa) => ({
        attributeId: pa.attributeId,
        name: pa.attribute.name,
        slug: pa.attribute.slug,
        value: pa.value?.value ?? pa.valueText ?? '',
        valueId: pa.valueId,
        unit: pa.attribute.unit,
        sortOrder: pa.attribute.sortOrder,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ sortOrder: _s, ...rest }) => rest),
    specifications: row.specifications.map((s) => ({
      id: s.id,
      group: s.group,
      name: s.name,
      value: s.value,
      sortOrder: s.sortOrder,
    })),
    breadcrumb,
    weightGrams: row.weightGrams,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
