/**
 * Order and payment contracts. Money fields are integers in IRR.
 */

export const OrderStatuses = [
  'PENDING_PAYMENT',
  'PAID',
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'RETURNED',
  'REFUNDED',
] as const;
export type OrderStatus = (typeof OrderStatuses)[number];

export const PaymentProviders = ['ZARINPAL', 'SNAPP_PAY', 'DIGIPAY', 'TOROB_PAY', 'MOCK'] as const;
export type PaymentProviderName = (typeof PaymentProviders)[number];

export const PaymentEnvironments = ['SANDBOX', 'PRODUCTION'] as const;
export type PaymentEnvironment = (typeof PaymentEnvironments)[number];

export const PaymentStatuses = [
  'INITIATED',
  'REDIRECTED',
  'CALLBACK_RECEIVED',
  'VERIFYING',
  'PAID',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
  'REFUNDED',
] as const;
export type PaymentStatus = (typeof PaymentStatuses)[number];

export interface OrderItemView {
  id: string;
  variantId: string | null;
  productId: string | null;
  productTitle: string;
  productSlug: string;
  variantTitle: string | null;
  sku: string;
  imageUrl: string | null;
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
  lineTotal: number;
  /** Seller who fulfils this line; null for platform stock. */
  seller: { id: string; storeName: string; slug: string } | null;
}

export interface OrderAddressView {
  recipientName: string;
  recipientPhone: string;
  province: string;
  city: string;
  addressLine: string;
  postalCode: string;
}

export interface OrderStatusEvent {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string | null;
  createdAt: string;
}

export interface ShipmentView {
  id: string;
  /** Seller who dispatched it; null for platform shipments. */
  sellerId: string | null;
  carrier: string | null;
  trackingCode: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  events: Array<{ id: string; status: string; description: string | null; occurredAt: string }>;
}

export interface PaymentView {
  id: string;
  orderId: string;
  orderNumber: string;
  provider: PaymentProviderName;
  environment: PaymentEnvironment;
  attemptNumber: number;
  amount: number;
  currency: 'IRR';
  status: PaymentStatus;
  providerAuthority: string | null;
  providerTransactionId: string | null;
  cardPanMask: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  verifiedAt: string | null;
}

export interface OrderSummary {
  id: string;
  number: string;
  status: OrderStatus;
  itemCount: number;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  currency: 'IRR';
  paymentDeadlineAt: string;
  paidAt: string | null;
  createdAt: string;
  /** First image among the items, for list rendering. */
  previewImageUrl: string | null;
}

export interface OrderDetail extends OrderSummary {
  items: OrderItemView[];
  address: OrderAddressView;
  shippingMethodCode: string;
  shippingMethodName: string;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  couponCode: string | null;
  customerNote: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  statusHistory: OrderStatusEvent[];
  payments: PaymentView[];
  shipments: ShipmentView[];
  /** True while the customer may still pay (PENDING_PAYMENT and not past the deadline). */
  payable: boolean;
  /** True while the customer may cancel it themselves. */
  cancellable: boolean;
}

export interface AdminOrderSummary extends OrderSummary {
  customer: { id: string; email: string | null; phone: string | null; name: string };
}

export interface AdminOrderDetail extends OrderDetail {
  customer: { id: string; email: string | null; phone: string | null; name: string };
}

/** Public description of a payment provider the customer may pick. */
export interface PaymentProviderInfo {
  provider: PaymentProviderName;
  displayName: string;
  description: string;
  environment: PaymentEnvironment;
  isDefault: boolean;
}

export interface CreatePaymentResponse {
  payment: PaymentView;
  /** Where the browser must go to complete the payment. */
  redirectUrl: string;
  /** GET redirects; some providers require a POST form. */
  redirectMethod: 'GET' | 'POST';
  redirectFields?: Record<string, string>;
}

export function formatOrderNumber(number: number): string {
  return `PE-${String(number).padStart(6, '0')}`;
}

/** Statuses from which a customer may cancel on their own. */
export const CUSTOMER_CANCELLABLE_STATUSES: readonly OrderStatus[] = ['PENDING_PAYMENT'];
