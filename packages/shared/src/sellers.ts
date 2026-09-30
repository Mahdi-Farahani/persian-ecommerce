import type { OrderAddressView, OrderItemView, OrderStatus, ShipmentView } from './orders.js';

/** Marketplace contracts. Money is integer IRR. */

export const SellerStatuses = ['PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED'] as const;
export type SellerStatus = (typeof SellerStatuses)[number];

export const SettlementStatuses = ['PENDING', 'PAID', 'CANCELLED'] as const;
export type SettlementStatus = (typeof SettlementStatuses)[number];

/** Commission is expressed in basis points: 1000 = 10%. */
export const COMMISSION_BPS_DENOMINATOR = 10_000;
export const MAX_COMMISSION_BPS = 5_000;

/** Public identity of a seller shown next to offers. */
export interface SellerPublicView {
  id: string;
  storeName: string;
  slug: string;
}

export interface SellerProfileView extends SellerPublicView {
  description: string | null;
  status: SellerStatus;
  commissionBps: number;
  contactPhone: string;
  contactEmail: string | null;
  legalName: string | null;
  nationalId: string | null;
  /** Masked, e.g. `IR12••••••••••••••••••3456`. */
  ibanMasked: string | null;
  province: string | null;
  city: string | null;
  addressLine: string | null;
  rejectionReason: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface AdminSellerView extends SellerProfileView {
  user: { id: string; email: string | null; phone: string | null; name: string };
  offerCount: number;
  pendingSettlementAmount: number;
  updatedAt: string;
}

/** A seller's offer: a variant they own, with its stock. */
export interface SellerOfferView {
  variantId: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  productStatus: string;
  imageUrl: string | null;
  sku: string;
  title: string | null;
  price: number;
  compareAtPrice: number | null;
  status: string;
  attributes: Array<{ attributeName: string; value: string }>;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStock: boolean;
}

export interface SellerOrderItemView extends OrderItemView {
  commissionAmount: number;
  sellerAmount: number;
  settlementId: string | null;
}

/** The part of an order a seller is allowed to see. */
export interface SellerOrderView {
  id: string;
  number: string;
  status: OrderStatus;
  createdAt: string;
  paidAt: string | null;
  address: OrderAddressView;
  shippingMethodName: string;
  customerNote: string | null;
  items: SellerOrderItemView[];
  /** Only this seller's shipments. */
  shipments: ShipmentView[];
  itemsTotal: number;
  sellerTotal: number;
  /** True when the seller still has to dispatch their items. */
  awaitingShipment: boolean;
}

export interface SettlementView {
  id: string;
  sellerId: string;
  status: SettlementStatus;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  itemCount: number;
  periodStart: string | null;
  periodEnd: string | null;
  note: string | null;
  paymentReference: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface AdminSettlementView extends SettlementView {
  seller: SellerPublicView;
}

export interface SellerDashboard {
  seller: SellerProfileView;
  sales: {
    last7Days: { orders: number; revenue: number };
    last30Days: { orders: number; revenue: number };
  };
  awaitingShipment: number;
  offers: { total: number; active: number; lowStock: number; outOfStock: number };
  settlements: { pendingAmount: number; pendingItems: number; paidAmount: number };
}

export const SELLER_STATUS_LABELS: Record<SellerStatus, string> = {
  PENDING: 'در انتظار تأیید',
  APPROVED: 'تأییدشده',
  SUSPENDED: 'معلق',
  REJECTED: 'ردشده',
};

export const SETTLEMENT_STATUS_LABELS: Record<SettlementStatus, string> = {
  PENDING: 'در انتظار پرداخت',
  PAID: 'پرداخت‌شده',
  CANCELLED: 'لغوشده',
};

/** Integer commission split; the seller receives the remainder. */
export function splitCommission(
  lineTotal: number,
  commissionBps: number,
): { commissionAmount: number; sellerAmount: number } {
  const commissionAmount = Math.floor((lineTotal * commissionBps) / COMMISSION_BPS_DENOMINATOR);
  return { commissionAmount, sellerAmount: lineTotal - commissionAmount };
}

export function maskIban(iban: string | null): string | null {
  if (!iban) return null;
  if (iban.length <= 8) return '••••';
  return `${iban.slice(0, 4)}${'•'.repeat(iban.length - 8)}${iban.slice(-4)}`;
}
