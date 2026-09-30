import { Injectable } from '@nestjs/common';
import { addMoney, multiplyMoney, percentOf, subtractMoney } from '@pe/shared';

export interface PricedLine {
  unitPrice: number;
  quantity: number;
}

export interface CouponRule {
  code: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  maxDiscountAmount: number | null;
  minCartAmount: number | null;
}

export interface ShippingRule {
  baseFee: number;
  freeAboveAmount: number | null;
}

export interface PriceBreakdown {
  subtotal: number;
  discount: number;
  total: number;
  itemCount: number;
}

/**
 * Pure integer money arithmetic for carts and checkout. No I/O, fully unit
 * testable; every amount is IRR.
 */
@Injectable()
export class PricingService {
  lineTotal(line: PricedLine): number {
    return multiplyMoney(line.unitPrice, line.quantity);
  }

  subtotal(lines: PricedLine[]): number {
    return addMoney(...lines.map((line) => this.lineTotal(line)));
  }

  /** Discount granted by a coupon on a subtotal (0 when the minimum is not met). */
  couponDiscount(subtotal: number, coupon: CouponRule | null): number {
    if (!coupon || subtotal <= 0) return 0;
    if (coupon.minCartAmount !== null && subtotal < coupon.minCartAmount) return 0;
    let discount = coupon.type === 'PERCENTAGE' ? percentOf(subtotal, coupon.value) : coupon.value;
    if (coupon.maxDiscountAmount !== null) discount = Math.min(discount, coupon.maxDiscountAmount);
    return Math.min(discount, subtotal);
  }

  breakdown(lines: PricedLine[], coupon: CouponRule | null): PriceBreakdown {
    const subtotal = this.subtotal(lines);
    const discount = this.couponDiscount(subtotal, coupon);
    return {
      subtotal,
      discount,
      total: subtractMoney(subtotal, discount),
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    };
  }

  /** Shipping fee for a given merchandise total (after discount). */
  shippingFee(total: number, rule: ShippingRule): number {
    if (rule.freeAboveAmount !== null && total >= rule.freeAboveAmount) return 0;
    return rule.baseFee;
  }

  grandTotal(total: number, shippingFee: number): number {
    return addMoney(total, shippingFee);
  }
}
