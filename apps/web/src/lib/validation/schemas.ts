import {
  IRAN_MOBILE_REGEX,
  IRAN_POSTAL_CODE_REGEX,
  IRAN_PROVINCES,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_REGEX,
  REVIEW_BODY_MAX,
  REVIEW_MAX_RATING,
  REVIEW_MIN_RATING,
  REVIEW_TITLE_MAX,
  normalizeIranMobile,
  toEnglishDigits,
} from '@pe/shared';
import * as yup from 'yup';
import { t } from '@/i18n';

const v = t.validation;

const password = yup
  .string()
  .required(v.required)
  .min(PASSWORD_MIN_LENGTH, v.passwordMin)
  .max(PASSWORD_MAX_LENGTH, v.maxLength(PASSWORD_MAX_LENGTH))
  .matches(PASSWORD_POLICY_REGEX, v.passwordPolicy);

const emailOrMobile = yup
  .string()
  .required(v.required)
  .transform((value: string) => value.trim())
  .test('email-or-mobile', v.emailOrMobile, (value) => {
    if (!value) return false;
    if (value.includes('@')) return yup.string().email().isValidSync(value);
    return normalizeIranMobile(value) !== null;
  });

export const loginSchema = yup.object({
  identifier: emailOrMobile,
  password: yup.string().required(v.required),
});
export type LoginFormValues = yup.InferType<typeof loginSchema>;

export const registerSchema = yup
  .object({
    email: yup
      .string()
      .transform((value: string) => value.trim().toLowerCase())
      .email(v.email)
      .default(''),
    phone: yup
      .string()
      .transform((value: string) =>
        value ? (normalizeIranMobile(value) ?? toEnglishDigits(value)) : '',
      )
      .test('mobile', v.mobile, (value) => !value || IRAN_MOBILE_REGEX.test(value))
      .default(''),
    firstName: yup
      .string()
      .transform((s: string) => s.trim())
      .max(100, v.maxLength(100))
      .default(''),
    lastName: yup
      .string()
      .transform((s: string) => s.trim())
      .max(100, v.maxLength(100))
      .default(''),
    password,
    confirmPassword: yup
      .string()
      .required(v.required)
      .oneOf([yup.ref('password')], v.passwordMismatch),
    acceptTerms: yup.boolean().oneOf([true], v.acceptTerms).required(v.acceptTerms),
  })
  .test('identifier-required', v.emailOrMobile, (values) => Boolean(values.email || values.phone));
export type RegisterFormValues = yup.InferType<typeof registerSchema>;

export const forgotPasswordSchema = yup.object({ identifier: emailOrMobile });
export type ForgotPasswordFormValues = yup.InferType<typeof forgotPasswordSchema>;

export const resetPasswordSchema = yup.object({
  password,
  confirmPassword: yup
    .string()
    .required(v.required)
    .oneOf([yup.ref('password')], v.passwordMismatch),
});
export type ResetPasswordFormValues = yup.InferType<typeof resetPasswordSchema>;

export const changePasswordSchema = yup.object({
  currentPassword: yup.string().required(v.required),
  newPassword: password,
  confirmPassword: yup
    .string()
    .required(v.required)
    .oneOf([yup.ref('newPassword')], v.passwordMismatch),
});
export type ChangePasswordFormValues = yup.InferType<typeof changePasswordSchema>;

export const profileSchema = yup.object({
  firstName: yup
    .string()
    .transform((s: string) => s.trim())
    .required(v.required)
    .max(100, v.maxLength(100)),
  lastName: yup
    .string()
    .transform((s: string) => s.trim())
    .required(v.required)
    .max(100, v.maxLength(100)),
});
export type ProfileFormValues = yup.InferType<typeof profileSchema>;

export const addressSchema = yup.object({
  title: yup
    .string()
    .transform((s: string) => s.trim())
    .required(v.required)
    .max(100, v.maxLength(100)),
  recipientName: yup
    .string()
    .transform((s: string) => s.trim())
    .required(v.required)
    .min(2, v.minLength(2))
    .max(150, v.maxLength(150)),
  recipientPhone: yup
    .string()
    .required(v.required)
    .transform((value: string) => normalizeIranMobile(value) ?? toEnglishDigits(value.trim()))
    .matches(IRAN_MOBILE_REGEX, v.mobile),
  province: yup
    .string()
    .required(v.required)
    .test('province', v.required, (value) => (IRAN_PROVINCES as readonly string[]).includes(value)),
  city: yup
    .string()
    .transform((s: string) => s.trim())
    .required(v.required)
    .min(2, v.minLength(2))
    .max(100, v.maxLength(100)),
  addressLine: yup
    .string()
    .transform((s: string) => s.trim())
    .required(v.required)
    .min(5, v.minLength(5))
    .max(500, v.maxLength(500)),
  postalCode: yup
    .string()
    .required(v.required)
    .transform((value: string) => toEnglishDigits(value.trim()))
    .matches(IRAN_POSTAL_CODE_REGEX, v.postalCode),
  isDefault: yup.boolean().default(false),
});
export type AddressFormValues = yup.InferType<typeof addressSchema>;

export const REVIEW_TITLE_MIN = 3;
export const REVIEW_BODY_MIN = 10;

export const reviewSchema = yup.object({
  rating: yup
    .number()
    // Radio groups report '' (or nothing) until a star is picked.
    .transform((value: unknown, original: unknown) =>
      original === '' || original === null || original === undefined ? undefined : value,
    )
    .typeError(v.rating)
    .required(v.rating)
    .integer(v.rating)
    .min(REVIEW_MIN_RATING, v.rating)
    .max(REVIEW_MAX_RATING, v.rating),
  title: yup
    .string()
    .transform((s: string) => s.trim())
    .required(v.required)
    .min(REVIEW_TITLE_MIN, v.minLength(REVIEW_TITLE_MIN))
    .max(REVIEW_TITLE_MAX, v.maxLength(REVIEW_TITLE_MAX)),
  body: yup
    .string()
    .transform((s: string) => s.trim())
    .required(v.required)
    .min(REVIEW_BODY_MIN, v.minLength(REVIEW_BODY_MIN))
    .max(REVIEW_BODY_MAX, v.maxLength(REVIEW_BODY_MAX)),
});
export type ReviewFormValues = yup.InferType<typeof reviewSchema>;

// ---------------------------------------------------------------------------
// Marketplace: seller application / profile
// ---------------------------------------------------------------------------

export const SELLER_STORE_NAME_MIN = 3;
export const SELLER_STORE_NAME_MAX = 150;
export const SELLER_DESCRIPTION_MAX = 1000;
export const SELLER_NATIONAL_ID_REGEX = /^\d{10,11}$/;
export const SELLER_IBAN_REGEX = /^IR\d{24}$/;

const sv = t.seller.validation;

/** Optional trimmed text; empty strings stay empty so the payload builder can drop them. */
const optionalText = (max: number) =>
  yup
    .string()
    .transform((s: string) => (s ?? '').trim())
    .max(max, v.maxLength(max))
    .default('');

export const sellerApplicationSchema = yup.object({
  storeName: yup
    .string()
    .transform((s: string) => s.trim())
    .required(v.required)
    .min(SELLER_STORE_NAME_MIN, sv.storeName)
    .max(SELLER_STORE_NAME_MAX, sv.storeName),
  description: optionalText(SELLER_DESCRIPTION_MAX),
  contactPhone: yup
    .string()
    .required(v.required)
    .transform((value: string) => normalizeIranMobile(value) ?? toEnglishDigits(value.trim()))
    .matches(IRAN_MOBILE_REGEX, v.mobile),
  contactEmail: yup
    .string()
    .transform((s: string) => (s ?? '').trim().toLowerCase())
    .test('email', v.email, (value) => !value || yup.string().email().isValidSync(value))
    .max(255, v.maxLength(255))
    .default(''),
  legalName: optionalText(255),
  nationalId: yup
    .string()
    .transform((s: string) => toEnglishDigits((s ?? '').trim()))
    .test('national-id', sv.nationalId, (value) => !value || SELLER_NATIONAL_ID_REGEX.test(value))
    .default(''),
  iban: yup
    .string()
    .transform((s: string) => toEnglishDigits((s ?? '').replace(/\s+/g, '')).toUpperCase())
    .test('iban', sv.iban, (value) => !value || SELLER_IBAN_REGEX.test(value))
    .default(''),
  province: yup
    .string()
    .transform((s: string) => (s ?? '').trim())
    .test(
      'province',
      v.required,
      (value) => !value || (IRAN_PROVINCES as readonly string[]).includes(value),
    )
    .default(''),
  city: optionalText(100),
  addressLine: optionalText(500),
});
export type SellerApplicationFormValues = yup.InferType<typeof sellerApplicationSchema>;
