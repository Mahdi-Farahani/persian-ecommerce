import {
  AttributeTypes,
  ProductStatuses,
  SLUG_REGEX,
  VariantStatuses,
  toEnglishDigits,
  toPersianDigits,
} from '@pe/shared';
import * as yup from 'yup';
import { adminFa } from '@/i18n/admin-fa';
import { hasAtMostTwoDecimals, MAX_COMMISSION_PERCENT, parseDecimalInput } from './sellers';
import { CouponTypes } from './types';

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

// ---------------------------------------------------------------------------
// Coupon
// ---------------------------------------------------------------------------

const COUPON_CODE_REGEX = /^[A-Z0-9_-]+$/;
const COUPON_CODE_MIN = 3;
const COUPON_CODE_MAX = 50;
const PERCENT_MAX = 100;

/** Optional positive integer (>= 1); empty input is omitted. */
const optionalPositiveInteger = () => optionalInteger().min(1, v.positive);

/** Optional `datetime-local` value; empty strings become undefined. */
const optionalDateTime = () =>
  yup
    .string()
    .transform((value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined))
    .optional();

/**
 * Coupon form. Money fields are entered in Toman (`*Toman`) and converted to
 * IRR by the mapper; date fields hold `datetime-local` strings.
 */
export const couponSchema = yup.object({
  code: yup
    .string()
    .transform((value: string) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
    .required(v.required)
    .min(COUPON_CODE_MIN, v.minLength(COUPON_CODE_MIN))
    .max(COUPON_CODE_MAX, v.maxLength(COUPON_CODE_MAX))
    .matches(COUPON_CODE_REGEX, v.couponCode),
  description: optionalText(255),
  type: yup
    .string()
    .oneOf([...CouponTypes], v.required)
    .required(v.required),
  /** Percent for PERCENTAGE coupons, Toman for FIXED ones. */
  value: requiredInteger()
    .min(1, v.positive)
    .when('type', {
      is: 'PERCENTAGE',
      then: (schema) => schema.max(PERCENT_MAX, v.percentRange),
    }),
  maxDiscountToman: optionalInteger(),
  minCartToman: optionalInteger(),
  startsAt: optionalDateTime(),
  endsAt: optionalDateTime().test('after-start', v.endAfterStart, (value, context) => {
    const startsAt = (context.parent as { startsAt?: string }).startsAt;
    if (!value || !startsAt) return true;
    return new Date(value).getTime() > new Date(startsAt).getTime();
  }),
  usageLimit: optionalPositiveInteger(),
  usageLimitPerUser: optionalPositiveInteger(),
  isActive: yup.boolean().default(true),
});
export type CouponFormValues = yup.InferType<typeof couponSchema>;

// ---------------------------------------------------------------------------
// Shipping method
// ---------------------------------------------------------------------------

const SHIPPING_CODE_REGEX = /^[a-z0-9-]+$/;
const SHIPPING_DAYS_MIN_MAX = 60;
const SHIPPING_DAYS_MAX_MAX = 90;
const SORT_ORDER_MAX = 10_000;

/** Shipping method form; fees are entered in Toman and converted by the mapper. */
export const shippingMethodSchema = yup.object({
  code: yup
    .string()
    .transform((value: string) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
    .required(v.required)
    .min(2, v.minLength(2))
    .max(50, v.maxLength(50))
    .matches(SHIPPING_CODE_REGEX, v.shippingCode),
  name: trimmed().required(v.required).min(2, v.minLength(2)).max(150, v.maxLength(150)),
  description: optionalText(500),
  baseFeeToman: requiredInteger(),
  freeAboveToman: optionalInteger(),
  estimatedDaysMin: requiredInteger().max(SHIPPING_DAYS_MIN_MAX, v.maxValue(SHIPPING_DAYS_MIN_MAX)),
  estimatedDaysMax: requiredInteger()
    .max(SHIPPING_DAYS_MAX_MAX, v.maxValue(SHIPPING_DAYS_MAX_MAX))
    .test('after-min', v.daysMaxAfterMin, (value, context) => {
      const min = (context.parent as { estimatedDaysMin?: number }).estimatedDaysMin;
      return value === undefined || min === undefined || value >= min;
    }),
  isActive: yup.boolean().default(true),
  sortOrder: sortOrder().max(SORT_ORDER_MAX, v.maxValue(SORT_ORDER_MAX)),
});
export type ShippingMethodFormValues = yup.InferType<typeof shippingMethodSchema>;

// ---------------------------------------------------------------------------
// Sellers & settlements
// ---------------------------------------------------------------------------

const SELLER_REASON_MAX = 500;
const PAYMENT_REFERENCE_MAX = 100;

/** Commission editor; the percent is converted to basis points by the caller. */
export const commissionSchema = yup.object({
  percent: yup
    .number()
    .transform((_value: unknown, original: unknown) => parseDecimalInput(original))
    .typeError(v.number)
    .min(0, v.commissionRange(toPersianDigits(MAX_COMMISSION_PERCENT)))
    .max(MAX_COMMISSION_PERCENT, v.commissionRange(toPersianDigits(MAX_COMMISSION_PERCENT)))
    .test('scale', v.twoDecimals, (value) => value === undefined || hasAtMostTwoDecimals(value))
    .required(v.required),
});
export type CommissionFormValues = yup.InferType<typeof commissionSchema>;

export const sellerRejectSchema = yup.object({
  reason: optionalText(SELLER_REASON_MAX),
});
export type SellerRejectFormValues = yup.InferType<typeof sellerRejectSchema>;

/** Marks a settlement as paid; the bank reference is mandatory for bookkeeping. */
export const settlementPaymentSchema = yup.object({
  paymentReference: trimmed()
    .required(v.required)
    .max(PAYMENT_REFERENCE_MAX, v.maxLength(PAYMENT_REFERENCE_MAX)),
  note: optionalText(SELLER_REASON_MAX),
});
export type SettlementPaymentFormValues = yup.InferType<typeof settlementPaymentSchema>;
