import { MAX_MONEY_AMOUNT, RIALS_PER_TOMAN, toEnglishDigits } from '@pe/shared';
import * as yup from 'yup';
import { t } from '@/i18n';
import type { SellerApplicationFormValues } from '@/lib/validation/schemas';

const v = t.validation;
const sv = t.seller.validation;

export const OFFER_SKU_REGEX = /^[A-Za-z0-9._-]+$/;
export const OFFER_SKU_MIN = 2;
export const OFFER_SKU_MAX = 64;
export const OFFER_TITLE_MAX = 255;
export const OFFER_STOCK_MAX = 1_000_000;
export const OFFER_LOW_STOCK_MAX = 100_000;
export const STOCK_ADJUST_MAX = 1_000_000;
export const SHIPMENT_TEXT_MAX = 100;
export const SHIPMENT_NOTE_MAX = 255;
/** Largest amount (in Toman) that still fits the shared money limit once converted to IRR. */
const MAX_TOMAN = Math.floor(MAX_MONEY_AMOUNT / RIALS_PER_TOMAN);

/**
 * Parses a user-typed number: Persian/Arabic digits are normalised and
 * thousands separators are ignored. Empty input becomes `undefined` so
 * `.required()`/`.optional()` decide whether it is acceptable.
 */
export function parseUserNumber(original: unknown): number | undefined {
  if (typeof original === 'number') return Number.isNaN(original) ? undefined : original;
  if (typeof original !== 'string') return undefined;
  const cleaned = toEnglishDigits(original)
    .replace(/[,٬\s]/g, '')
    .trim();
  if (cleaned === '') return undefined;
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

const userNumber = () =>
  yup
    .number()
    .transform((_value: unknown, original: unknown) => parseUserNumber(original))
    .typeError(sv.number);

const tomanAmount = () =>
  userNumber().integer(sv.integer).min(1, sv.price).max(MAX_TOMAN, sv.number);

const optionalText = (max: number) =>
  yup
    .string()
    .transform((s: string) => (s ?? '').trim())
    .max(max, v.maxLength(max))
    .default('');

export const OfferStatusOptions = ['ACTIVE', 'INACTIVE'] as const;
export type OfferStatusOption = (typeof OfferStatusOptions)[number];

/** Shared price fields: amounts are entered in Toman and converted to IRR on submit. */
const priceFields = {
  price: tomanAmount().required(v.required),
  compareAtPrice: userNumber()
    .integer(sv.integer)
    .min(1, sv.price)
    .max(MAX_TOMAN, sv.number)
    .optional()
    .test('greater-than-price', sv.compareAtPrice, function (value) {
      if (value === undefined) return true;
      const price = (this.parent as { price?: number }).price;
      return price === undefined || value > price;
    }),
};

export const sellerOfferSchema = yup.object({
  sku: yup
    .string()
    .transform((s: string) => (s ?? '').trim())
    .required(v.required)
    .min(OFFER_SKU_MIN, v.minLength(OFFER_SKU_MIN))
    .max(OFFER_SKU_MAX, v.maxLength(OFFER_SKU_MAX))
    .matches(OFFER_SKU_REGEX, sv.sku),
  title: optionalText(OFFER_TITLE_MAX),
  ...priceFields,
  initialStock: userNumber()
    .integer(sv.integer)
    .min(0, sv.nonNegative)
    .max(OFFER_STOCK_MAX, sv.number)
    .default(0),
  lowStockThreshold: userNumber()
    .integer(sv.integer)
    .min(0, sv.nonNegative)
    .max(OFFER_LOW_STOCK_MAX, sv.number)
    .default(5),
});
export type SellerOfferFormValues = yup.InferType<typeof sellerOfferSchema>;

export const sellerOfferEditSchema = yup.object({
  title: optionalText(OFFER_TITLE_MAX),
  ...priceFields,
  status: yup.string().oneOf(OfferStatusOptions, v.required).required(v.required),
});
export type SellerOfferEditFormValues = yup.InferType<typeof sellerOfferEditSchema>;

export const sellerStockAdjustSchema = yup.object({
  quantity: userNumber()
    .required(v.required)
    .integer(sv.integer)
    .min(-STOCK_ADJUST_MAX, sv.number)
    .max(STOCK_ADJUST_MAX, sv.number)
    .test('non-zero', sv.nonZero, (value) => value !== 0),
  note: optionalText(SHIPMENT_NOTE_MAX),
});
export type SellerStockAdjustFormValues = yup.InferType<typeof sellerStockAdjustSchema>;

export const sellerShipmentSchema = yup.object({
  carrier: optionalText(SHIPMENT_TEXT_MAX),
  trackingCode: yup
    .string()
    .transform((s: string) => toEnglishDigits((s ?? '').trim()))
    .max(SHIPMENT_TEXT_MAX, v.maxLength(SHIPMENT_TEXT_MAX))
    .default(''),
  note: optionalText(SHIPMENT_NOTE_MAX),
});
export type SellerShipmentFormValues = yup.InferType<typeof sellerShipmentSchema>;

// ---------------------------------------------------------------------------
// Payload builders (form values → API bodies)
// ---------------------------------------------------------------------------

export interface SellerApplicationPayload {
  storeName: string;
  contactPhone: string;
  description?: string | null;
  contactEmail?: string | null;
  legalName?: string | null;
  nationalId?: string | null;
  iban?: string;
  province?: string | null;
  city?: string | null;
  addressLine?: string | null;
}

const OPTIONAL_APPLICATION_FIELDS = [
  'description',
  'contactEmail',
  'legalName',
  'nationalId',
  'province',
  'city',
  'addressLine',
] as const;

/**
 * Builds the `/seller/apply` or `/seller/profile` body. On apply, blank
 * optional fields are omitted. On edit, they are sent as `null` so the API
 * clears them; the IBAN is the exception, because the form never shows the
 * stored value, so leaving it blank keeps the existing one.
 */
export function toSellerApplicationPayload(
  values: SellerApplicationFormValues,
  mode: 'apply' | 'edit',
): SellerApplicationPayload {
  const payload: SellerApplicationPayload = {
    storeName: values.storeName,
    contactPhone: values.contactPhone,
  };
  for (const key of OPTIONAL_APPLICATION_FIELDS) {
    const value = values[key];
    if (value) payload[key] = value;
    else if (mode === 'edit') payload[key] = null;
  }
  if (values.iban) payload.iban = values.iban;
  return payload;
}

export function tomanToRials(toman: number): number {
  return toman * RIALS_PER_TOMAN;
}

export function rialsToToman(rials: number): number {
  return Math.floor(rials / RIALS_PER_TOMAN);
}

export interface SellerShipmentPayload {
  carrier?: string;
  trackingCode?: string;
  note?: string;
}

export function toSellerShipmentPayload(values: SellerShipmentFormValues): SellerShipmentPayload {
  const payload: SellerShipmentPayload = {};
  if (values.carrier) payload.carrier = values.carrier;
  if (values.trackingCode) payload.trackingCode = values.trackingCode;
  if (values.note) payload.note = values.note;
  return payload;
}
