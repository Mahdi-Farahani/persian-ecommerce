import { fromToman, toToman } from '@pe/shared';
import type { CouponFormValues } from './schemas';
import type { AdminCoupon, CouponInput, CouponType } from './types';

/** Pads a date part to two digits for `datetime-local` values. */
function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Converts an ISO timestamp to the browser-local `YYYY-MM-DDTHH:mm` form
 * expected by `<input type="datetime-local">`. Empty for null/invalid input.
 */
export function isoToDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** Converts a `datetime-local` value (local time) back to an ISO timestamp. */
export function dateTimeLocalToIso(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Form defaults for a new coupon. */
export function emptyCouponFormValues(): CouponFormValues {
  return {
    code: '',
    description: undefined,
    type: 'PERCENTAGE',
    value: undefined as unknown as number,
    maxDiscountToman: undefined,
    minCartToman: undefined,
    startsAt: undefined,
    endsAt: undefined,
    usageLimit: undefined,
    usageLimitPerUser: undefined,
    isActive: true,
  };
}

/** Maps an API coupon to form values (IRR shown as Toman, ISO as local time). */
export function couponToFormValues(coupon: AdminCoupon): CouponFormValues {
  return {
    code: coupon.code,
    description: coupon.description ?? undefined,
    type: coupon.type,
    value: coupon.type === 'FIXED' ? toToman(coupon.value) : coupon.value,
    maxDiscountToman:
      coupon.maxDiscountAmount === null ? undefined : toToman(coupon.maxDiscountAmount),
    minCartToman: coupon.minCartAmount === null ? undefined : toToman(coupon.minCartAmount),
    startsAt: isoToDateTimeLocal(coupon.startsAt) || undefined,
    endsAt: isoToDateTimeLocal(coupon.endsAt) || undefined,
    usageLimit: coupon.usageLimit ?? undefined,
    usageLimitPerUser: coupon.usageLimitPerUser ?? undefined,
    isActive: coupon.isActive,
  };
}

/** Maps validated form values to the API payload (Toman -> IRR, local -> ISO). */
export function couponFormToInput(values: CouponFormValues): CouponInput {
  const type = values.type as CouponType;
  return {
    code: values.code,
    description: values.description,
    type,
    value: type === 'FIXED' ? fromToman(values.value) : values.value,
    maxDiscountAmount:
      values.maxDiscountToman === undefined ? null : fromToman(values.maxDiscountToman),
    minCartAmount: values.minCartToman === undefined ? null : fromToman(values.minCartToman),
    startsAt: dateTimeLocalToIso(values.startsAt),
    endsAt: dateTimeLocalToIso(values.endsAt),
    usageLimit: values.usageLimit ?? null,
    usageLimitPerUser: values.usageLimitPerUser ?? null,
    isActive: values.isActive,
  };
}

export type CouponLifecycle = 'active' | 'inactive' | 'scheduled' | 'expired' | 'exhausted';

/** Derives the effective state of a coupon for badges (independent of the flag alone). */
export function couponLifecycle(coupon: AdminCoupon, now: Date = new Date()): CouponLifecycle {
  if (!coupon.isActive) return 'inactive';
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return 'exhausted';
  const time = now.getTime();
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > time) return 'scheduled';
  if (coupon.endsAt && new Date(coupon.endsAt).getTime() < time) return 'expired';
  return 'active';
}
