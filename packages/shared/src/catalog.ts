/**
 * Catalog contracts shared between the API and the web app.
 * Money fields are integers in IRR (see money.ts).
 */

export const ProductStatuses = [
  'DRAFT',
  'PENDING_REVIEW',
  'ACTIVE',
  'INACTIVE',
  'OUT_OF_STOCK',
  'ARCHIVED',
] as const;
export type ProductStatus = (typeof ProductStatuses)[number];

/** Statuses visible to customers. */
export const PUBLIC_PRODUCT_STATUSES: readonly ProductStatus[] = ['ACTIVE', 'OUT_OF_STOCK'];

export const VariantStatuses = ['ACTIVE', 'INACTIVE'] as const;
export type VariantStatus = (typeof VariantStatuses)[number];

export const AttributeTypes = ['SELECT', 'TEXT', 'NUMBER', 'BOOLEAN'] as const;
export type AttributeType = (typeof AttributeTypes)[number];

export const ProductSortOptions = [
  'relevance',
  'newest',
  'price_asc',
  'price_desc',
  'popular',
  'rating',
] as const;
export type ProductSort = (typeof ProductSortOptions)[number];

export interface BrandSummary {
  id: string;
  name: string;
  nameEn: string | null;
  slug: string;
  logoUrl: string | null;
}

export interface BrandDetail extends BrandSummary {
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
  productCount: number;
}

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  parentId: string | null;
  depth: number;
  sortOrder: number;
  isActive: boolean;
}

export interface CategoryNode extends CategorySummary {
  children: CategoryNode[];
}

export interface CategoryDetail extends CategorySummary {
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  breadcrumb: Array<{ id: string; name: string; slug: string }>;
  children: CategorySummary[];
  attributes: FilterableAttribute[];
}

export interface AttributeValueSummary {
  id: string;
  value: string;
  slug: string;
  colorHex: string | null;
  sortOrder: number;
}

export interface AttributeSummary {
  id: string;
  name: string;
  slug: string;
  type: AttributeType;
  unit: string | null;
  isVariant: boolean;
  isFilterable: boolean;
  sortOrder: number;
  values: AttributeValueSummary[];
}

export interface FilterableAttribute {
  id: string;
  name: string;
  slug: string;
  type: AttributeType;
  isVariant: boolean;
  values: AttributeValueSummary[];
}

export interface ProductImageSummary {
  id: string;
  url: string;
  alt: string | null;
  sortOrder: number;
  isPrimary: boolean;
  variantId: string | null;
}

export interface ProductCard {
  id: string;
  title: string;
  slug: string;
  image: ProductImageSummary | null;
  brand: BrandSummary | null;
  category: { id: string; name: string; slug: string };
  /** Lowest active variant price (IRR). */
  price: number | null;
  /** Compare-at price of the cheapest variant when discounted (IRR). */
  compareAtPrice: number | null;
  discountPercent: number;
  inStock: boolean;
  ratingAverage: number;
  ratingCount: number;
  status: ProductStatus;
}

export interface VariantAttributeSelection {
  attributeId: string;
  attributeName: string;
  attributeSlug: string;
  valueId: string;
  value: string;
  valueSlug: string;
  colorHex: string | null;
}

export interface VariantDetail {
  id: string;
  sku: string;
  barcode: string | null;
  title: string | null;
  price: number;
  compareAtPrice: number | null;
  discountPercent: number;
  status: VariantStatus;
  isDefault: boolean;
  weightGrams: number | null;
  attributes: VariantAttributeSelection[];
  availableQuantity: number;
  inStock: boolean;
  lowStock: boolean;
  imageIds: string[];
  /** Marketplace seller offering this variant; null for the platform itself. */
  seller: { id: string; storeName: string; slug: string } | null;
}

export interface ProductAttributeDisplay {
  attributeId: string;
  name: string;
  slug: string;
  value: string;
  /** Selected value id for SELECT attributes; null for free-text values. */
  valueId: string | null;
  unit: string | null;
}

export interface ProductSpecificationRow {
  id: string;
  group: string | null;
  name: string;
  value: string;
  sortOrder: number;
}

export interface ProductDetail extends Omit<ProductCard, 'image'> {
  titleEn: string | null;
  description: string | null;
  shortDescription: string | null;
  images: ProductImageSummary[];
  variants: VariantDetail[];
  /** Variant-defining attributes with the values used by this product. */
  variantAttributes: Array<{
    id: string;
    name: string;
    slug: string;
    values: AttributeValueSummary[];
  }>;
  attributes: ProductAttributeDisplay[];
  specifications: ProductSpecificationRow[];
  breadcrumb: Array<{ id: string; name: string; slug: string }>;
  weightGrams: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductListFilters {
  category?: string;
  brand?: string | string[];
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  attr?: Record<string, string | string[]>;
  sort?: ProductSort;
  q?: string;
  page?: number;
  limit?: number;
}
