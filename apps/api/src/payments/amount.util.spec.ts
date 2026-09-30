import { describe, expect, it } from 'vitest';
import { fromProviderAmount, parseProviderAmount, toProviderAmount } from './amount.util.js';
import { PaymentProviderError } from './payment.errors.js';

describe('amount adapters', () => {
  it('passes rial amounts through unchanged', () => {
    expect(toProviderAmount(1_250_000, 'IRR')).toBe(1_250_000);
    expect(fromProviderAmount(1_250_000, 'IRR')).toBe(1_250_000);
  });

  it('converts rial to toman and back without floating point', () => {
    expect(toProviderAmount(1_250_000, 'IRT')).toBe(125_000);
    expect(fromProviderAmount(125_000, 'IRT')).toBe(1_250_000);
  });

  it('refuses odd rial amounts for toman providers and invalid inputs', () => {
    expect(() => toProviderAmount(1_000_005, 'IRT')).toThrow(PaymentProviderError);
    expect(() => toProviderAmount(10.5, 'IRR')).toThrow(PaymentProviderError);
    expect(() => toProviderAmount(-1, 'IRR')).toThrow(PaymentProviderError);
  });

  it('parses provider amounts from numbers and numeric strings only', () => {
    expect(parseProviderAmount(100)).toBe(100);
    expect(parseProviderAmount(' 250 ')).toBe(250);
    expect(parseProviderAmount('25.5')).toBeNull();
    expect(parseProviderAmount(null)).toBeNull();
    expect(parseProviderAmount(Number.NaN)).toBeNull();
  });
});
