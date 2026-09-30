import {
  AttributeTypes,
  ProductStatuses,
  SLUG_REGEX,
  VariantStatuses,
  toEnglishDigits,
} from '@pe/shared';
import * as yup from 'yup';
import { adminFa } from '@/i18n/admin-fa';

const v = adminFa.validation;

const trimmed = () => yup.string().transform((s: string) => (typeof s === 'string' ? s.trim() : s));

/** Optional text: empty strings become undefined so they are omitted from payloads. */
const optionalText = (max: number) =>
  trimmed()
    .transform((s: string) => (s ? s : undefined))
    .max(max, v.maxLength(max))
    .optional();

const optionalSlug = (max: number) =>
  optionalText(max).test('slug', v.slug, (value) => !value || SLUG_REGEX.test(value));

/**
 * Integer parsed from a text input (Persian digits accepted). Empty input
 * yields undefined so optional numeric fields can be omitted.
 */
const optionalInteger = () =>
  yup
    .number()
    .transform((_value: unknown, original: unknown) => {
      if (original === undefined || original === null) return undefined;
      const raw = toEnglishDigits(String(original)).replace(/[,٬\s]/g, '');
      if (raw === '') return undefined;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    })
    .typeError(v.integer)
    .integer(v.integer)
    .min(0, v.nonNegative)
    .optional();

const requiredInteger = () => optionalInteger().required(v.required);

const sortOrder = () => optionalInteger().default(0);

export const colorHexSchema = yup
  .string()
  .transform((s: string) => (s ? s.trim() : ''))
  .test('color', v.colorHex, (value) => !value || /^#[0-9a-fA-F]{6}$/.test(value));

// ---------------------------------------------------------------------------
// Brand
// ---------------------------------------------------------------------------

export const brandSchema = yup.object({
  name: trimmed().required(v.required).max(150, v.maxLength(150)),
  nameEn: optionalText(150),
  slug: optionalSlug(180),
  description: optionalText(5000),
  logoUrl: yup.string().default(''),
  isActive: yup.boolean().default(true),
  sortOrder: sortOrder(),
  seoTitle: optionalText(255),
  seoDescription: optionalText(500),
});
export type BrandFormValues = yup.InferType<typeof brandSchema>;

// ---------------------------------------------------------------------------
// Category
// ---------------------------------------------------------------------------

export const categorySchema = yup.object({
  name: trimmed().required(v.required).max(150, v.maxLength(150)),
  slug: optionalSlug(180),
  parentId: yup.string().default(''),
  description: optionalText(5000),
  imageUrl: yup.string().default(''),
  sortOrder: sortOrder(),
  isActive: yup.boolean().default(true),
  seoTitle: optionalText(255),
  seoDescription: optionalText(500),
  attributes: yup
    .array()
    .of(
      yup.object({
        attributeId: yup.string().required(),
        isRequired: yup.boolean().default(false),
      }),
    )
    .default([]),
});
export type CategoryFormValues = yup.InferType<typeof categorySchema>;

// ---------------------------------------------------------------------------
// Attribute
// ---------------------------------------------------------------------------

export const attributeValueSchema = yup.object({
  id: yup.string().optional(),
  value: trimmed().required(v.required).max(150, v.maxLength(150)),
  slug: optionalSlug(150),
  colorHex: colorHexSchema.default(''),
  sortOrder: sortOrder(),
});

export const attributeSchema = yup.object({
  name: trimmed().required(v.required).max(150, v.maxLength(150)),
  slug: optionalSlug(100),
  type: yup
    .string()
    .oneOf([...AttributeTypes], v.required)
    .required(v.required),
  unit: optionalText(30),
  isVariant: yup.boolean().default(false),
  isFilterable: yup.boolean().default(false),
  sortOrder: sortOrder(),
  values: yup
    .array()
    .of(attributeValueSchema)
    .default([])
    .when('type', {
      is: 'SELECT',
      then: (schema) =>
        schema.min(1, v.valuesRequired).test('unique', v.duplicateValues, (values) => {
          const names = (values ?? []).map((item) => item.value.trim());
          return new Set(names).size === names.length;
        }),
    }),
});
export type AttributeFormValues = yup.InferType<typeof attributeSchema>;
export type AttributeValueFormValues = yup.InferType<typeof attributeValueSchema>;

// ---------------------------------------------------------------------------
// Product
// ---------------------------------------------------------------------------

export const productAttributeRowSchema = yup.object({
  attributeId: yup.string().required(v.required),
  /** Value id for SELECT attributes; free text otherwise. */
  value: trimmed().required(v.required).max(255, v.maxLength(255)),
});

export const specificationRowSchema = yup.object({
  group: optionalText(100),
  name: trimmed().required(v.required).max(150, v.maxLength(150)),
  value: trimmed().required(v.required).max(500, v.maxLength(500)),
});

export const productSchema = yup.object({
  title: trimmed().required(v.required).max(255, v.maxLength(255)),
  titleEn: optionalText(255),
  slug: optionalSlug(180),
  categoryId: yup.string().required(v.required),
  brandId: yup.string().default(''),
  status: yup
    .string()
    .oneOf([...ProductStatuses], v.required)
    .required(v.required),
  weightGrams: optionalInteger(),
  shortDescription: optionalText(500),
  description: optionalText(20000),
  seoTitle: optionalText(255),
  seoDescription: optionalText(500),
  attributes: yup.array().of(productAttributeRowSchema).default([]),
  specifications: yup.array().of(specificationRowSchema).default([]),
});
export type ProductFormValues = yup.InferType<typeof productSchema>;

/** Variant form; prices are entered in Toman and converted by the caller. */
export const variantSchema = yup.object({
  sku: trimmed().required(v.required).max(64, v.maxLength(64)),
  barcode: optionalText(64),
  title: optionalText(255),
  priceToman: requiredInteger(),
  compareAtPriceToman: optionalInteger().test(
    'greater-than-price',
    v.compareAtPrice,
    (value, context) => {
      const price = (context.parent as { priceToman?: number }).priceToman;
      return value === undefined || price === undefined || value > price;
    },
  ),
  status: yup
    .string()
    .oneOf([...VariantStatuses], v.required)
    .required(v.required),
  isDefault: yup.boolean().default(false),
  weightGrams: optionalInteger(),
  initialStock: optionalInteger(),
  lowStockThreshold: optionalInteger(),
  /** attributeId -> valueId ('' when not chosen). */
  attributeValues: yup
    .mixed<Record<string, string>>()
    .transform((value: unknown) =>
      value && typeof value === 'object' ? (value as Record<string, string>) : {},
    )
    .default(() => ({})),
});
export type VariantFormValues = yup.InferType<typeof variantSchema>;

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export const inventoryAdjustSchema = yup.object({
  quantity: yup
    .number()
    .transform((_value: unknown, original: unknown) => {
      const raw = toEnglishDigits(String(original ?? ''))
        .replace(/[,٬\s]/g, '')
        .replace('−', '-');
      if (raw === '') return Number.NaN;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    })
    .typeError(v.integer)
    .integer(v.integer)
    .notOneOf([0], v.nonZero)
    .required(v.required),
  type: yup
    .string()
    .oneOf(['ADJUSTMENT', 'PURCHASE', 'RETURN'] as const)
    .required(v.required),
  note: optionalText(500),
});
export type InventoryAdjustFormValues = yup.InferType<typeof inventoryAdjustSchema>;
