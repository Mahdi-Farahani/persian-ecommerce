import type {
  AttributeType,
  AuthUser,
  CategorySummary,
  ProductStatus,
  RoleName,
  UserStatus,
  VariantStatus,
} from '@pe/shared';

/** Category row as returned by `GET /admin/categories` (flat list). */
export interface AdminCategory extends CategorySummary {
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  path: string;
  productCount: number;
  attributes: Array<{
    attributeId: string;
    name: string;
    slug: string;
    isRequired: boolean;
    sortOrder: number;
  }>;
}

export interface CategoryAttributeLinkInput {
  attributeId: string;
  isRequired?: boolean;
  sortOrder?: number;
}

export interface CategoryInput {
  name: string;
  slug?: string;
  parentId?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  attributes?: CategoryAttributeLinkInput[];
}

export interface BrandInput {
  name: string;
  nameEn?: string | null;
  slug?: string;
  description?: string | null;
  logoUrl?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export interface AttributeValueInput {
  id?: string;
  value: string;
  slug?: string;
  colorHex?: string | null;
  sortOrder?: number;
}

export interface AttributeInput {
  name: string;
  slug?: string;
  type: AttributeType;
  unit?: string | null;
  isVariant?: boolean;
  isFilterable?: boolean;
  sortOrder?: number;
  values?: AttributeValueInput[];
}

export interface ProductAttributeInput {
  attributeId: string;
  valueId?: string;
  valueText?: string;
}

export interface ProductSpecificationInput {
  group?: string;
  name: string;
  value: string;
  sortOrder?: number;
}

export interface VariantAttributeInput {
  attributeId: string;
  valueId: string;
}

/** Variant payload; money fields are integers in IRR. */
export interface VariantInput {
  sku: string;
  barcode?: string | null;
  title?: string | null;
  price: number;
  compareAtPrice?: number | null;
  status?: VariantStatus;
  isDefault?: boolean;
  weightGrams?: number | null;
  sortOrder?: number;
  attributeValues?: VariantAttributeInput[];
  initialStock?: number;
  lowStockThreshold?: number;
}

export interface ProductImageInput {
  url: string;
  alt?: string | null;
  sortOrder?: number;
  isPrimary?: boolean;
  variantId?: string | null;
}

export interface ProductBaseInput {
  title: string;
  titleEn?: string | null;
  slug?: string;
  categoryId: string;
  brandId?: string | null;
  description?: string | null;
  shortDescription?: string | null;
  status?: ProductStatus;
  weightGrams?: number | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  attributes?: ProductAttributeInput[];
  specifications?: ProductSpecificationInput[];
}

export interface CreateProductInput extends ProductBaseInput {
  variants: VariantInput[];
  images?: ProductImageInput[];
}

export type UpdateProductInput = Partial<ProductBaseInput>;

export interface InventorySnapshot {
  variantId: string;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  lowStock: boolean;
  updatedAt: string;
}

export const InventoryAdjustmentTypes = ['ADJUSTMENT', 'PURCHASE', 'RETURN'] as const;
export type InventoryAdjustmentType = (typeof InventoryAdjustmentTypes)[number];

export interface InventoryAdjustInput {
  quantity: number;
  type?: InventoryAdjustmentType;
  note?: string;
}

export interface UploadedImage {
  key: string;
  url: string;
  size: number;
  contentType: string;
  width: number;
  height: number;
}

/** User row as returned by `GET /admin/users`. */
export interface AdminUser extends AuthUser {
  lastLoginAt: string | null;
  updatedAt: string;
}

export interface RoleInfo {
  id: string;
  name: RoleName;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}

export interface PermissionInfo {
  key: string;
  group: string;
  description: string;
}

export type { ProductStatus, UserStatus, VariantStatus };
