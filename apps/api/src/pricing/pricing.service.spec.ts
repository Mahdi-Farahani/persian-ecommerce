import { PricingService } from './pricing.service.js';

describe('PricingService', () => {
  const pricing = new PricingService();
  const lines = [
    { unitPrice: 1_000_000, quantity: 2 },
    { unitPrice: 250_000, quantity: 1 },
  ];

  it('computes subtotal with integer arithmetic', () => {
    expect(pricing.subtotal(lines)).toBe(2_250_000);
    expect(pricing.subtotal([])).toBe(0);
  });

  it('applies percentage coupons with caps and minimums', () => {
    const coupon = {
      code: 'X',
      type: 'PERCENTAGE' as const,
      value: 10,
      maxDiscountAmount: null,
      minCartAmount: null,
    };
    expect(pricing.couponDiscount(2_250_000, coupon)).toBe(225_000);
    expect(pricing.couponDiscount(2_250_000, { ...coupon, maxDiscountAmount: 100_000 })).toBe(
      100_000,
    );
    expect(pricing.couponDiscount(2_250_000, { ...coupon, minCartAmount: 3_000_000 })).toBe(0);
    expect(pricing.couponDiscount(0, coupon)).toBe(0);
  });

  it('never discounts more than the subtotal for fixed coupons', () => {
    const coupon = {
      code: 'F',
      type: 'FIXED' as const,
      value: 5_000_000,
      maxDiscountAmount: null,
      minCartAmount: null,
    };
    expect(pricing.couponDiscount(2_250_000, coupon)).toBe(2_250_000);
    expect(pricing.breakdown(lines, coupon).total).toBe(0);
  });

  it('computes a full breakdown', () => {
    const result = pricing.breakdown(lines, {
      code: 'X',
      type: 'PERCENTAGE',
      value: 20,
      maxDiscountAmount: null,
      minCartAmount: null,
    });
    expect(result).toEqual({
      subtotal: 2_250_000,
      discount: 450_000,
      total: 1_800_000,
      itemCount: 3,
    });
  });

  it('applies free-shipping thresholds', () => {
    const rule = { baseFee: 350_000, freeAboveAmount: 5_000_000 };
    expect(pricing.shippingFee(4_999_999, rule)).toBe(350_000);
    expect(pricing.shippingFee(5_000_000, rule)).toBe(0);
    expect(pricing.shippingFee(1, { baseFee: 350_000, freeAboveAmount: null })).toBe(350_000);
    expect(pricing.grandTotal(1_800_000, 350_000)).toBe(2_150_000);
  });

  it('rejects non-integer money', () => {
    expect(() => pricing.subtotal([{ unitPrice: 10.5, quantity: 1 }])).toThrow(RangeError);
  });
});
