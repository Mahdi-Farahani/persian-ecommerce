/**
 * Cart and checkout contracts. Money fields are integers in IRR.
 */

export interface CartItemView {
  id: string;
  variantId: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  variantTitle: string | null;
  sku: string;
  image: { url: string; alt: string | null } | null;
  /** Current unit price. */
  unitPrice: number;
  compareAtPrice: number | null;
  /** Unit price when the item was added; differs from unitPrice when it changed. */
  priceAtAdd: number;
  priceChanged: boolean;
  quantity: number;
  lineTotal: number;
  availableQuantity: number;
  inStock: boolean;
  /** True when the requested quantity exceeds availability. */
  quantityExceedsStock: boolean;
}

export type CartWarningCode =
  'PRICE_CHANGED' | 'OUT_OF_STOCK' | 'QUANTITY_REDUCED' | 'ITEM_UNAVAILABLE' | 'COUPON_INVALID';

export interface CartWarning {
  code: CartWarningCode;
  itemId?: string;
  message: string;
}

export interface CartTotals {
  /** Sum of line totals at current prices. */
  subtotal: number;
  /** Coupon discount applied to the subtotal. */
  discount: number;
  /** Subtotal minus discount (shipping is added at checkout). */
  total: number;
  itemCount: number;
  currency: 'IRR';
}

export interface AppliedCoupon {
  code: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  discount: number;
  description: string | null;
}

export interface CartView {
  id: string;
  items: CartItemView[];
  coupon: AppliedCoupon | null;
  totals: CartTotals;
  warnings: CartWarning[];
  updatedAt: string;
}

export interface ShippingMethodView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  baseFee: number;
  freeAboveAmount: number | null;
  /** Fee for the current cart (0 when the free threshold is met). */
  fee: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
}

export interface CheckoutQuote {
  cart: CartView;
  address: {
    id: string;
    title: string;
    recipientName: string;
    recipientPhone: string;
    province: string;
    city: string;
    addressLine: string;
    postalCode: string;
  };
  shippingMethod: ShippingMethodView;
  totals: CartTotals & { shippingFee: number; grandTotal: number };
  /** Blocking problems; the order cannot be placed while any exist. */
  issues: CartWarning[];
  canPlaceOrder: boolean;
}

export const CART_MAX_LINE_QUANTITY = 10;
export const CART_MAX_LINES = 50;
