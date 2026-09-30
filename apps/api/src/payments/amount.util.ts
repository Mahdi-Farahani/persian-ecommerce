import { PaymentErrorCodes, PaymentProviderError } from './payment.errors.js';

export type ProviderAmountUnit = 'IRR' | 'IRT';

/**
 * Converts the internal IRR integer to the unit a provider expects.
 * Toman (IRT) amounts must be whole; an odd rial amount cannot be sent.
 */
export function toProviderAmount(amountIrr: number, unit: ProviderAmountUnit): number {
  if (!Number.isInteger(amountIrr) || amountIrr < 0) {
    throw new PaymentProviderError(
      PaymentErrorCodes.Misconfigured,
      'مبلغ پرداخت باید عدد صحیح و نامنفی باشد',
    );
  }
  if (unit === 'IRR') return amountIrr;
  if (amountIrr % 10 !== 0) {
    throw new PaymentProviderError(
      PaymentErrorCodes.Misconfigured,
      'مبلغ ریالی برای ارسال به تومان باید مضرب ۱۰ باشد',
    );
  }
  return amountIrr / 10;
}

/** Converts a provider-reported amount back to IRR. */
export function fromProviderAmount(amount: number, unit: ProviderAmountUnit): number {
  return unit === 'IRR' ? amount : amount * 10;
}

/** Parses a provider amount field that may arrive as number or numeric string. */
export function parseProviderAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}
