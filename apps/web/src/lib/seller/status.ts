import type { SellerOfferView, SellerStatus, SettlementStatus } from '@pe/shared';
import { t } from '@/i18n';

export type SellerTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const sellerStatusTones: Record<SellerStatus, SellerTone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  SUSPENDED: 'danger',
  REJECTED: 'danger',
};

const settlementStatusTones: Record<SettlementStatus, SellerTone> = {
  PENDING: 'warning',
  PAID: 'success',
  CANCELLED: 'neutral',
};

export function sellerStatusTone(status: SellerStatus): SellerTone {
  return sellerStatusTones[status] ?? 'neutral';
}

export function settlementStatusTone(status: SettlementStatus): SellerTone {
  return settlementStatusTones[status] ?? 'neutral';
}

export function offerStatusTone(status: string): SellerTone {
  return status === 'ACTIVE' ? 'success' : 'neutral';
}

export function offerStockState(offer: Pick<SellerOfferView, 'availableQuantity' | 'lowStock'>): {
  tone: SellerTone;
  label: string;
} {
  if (offer.availableQuantity <= 0) return { tone: 'danger', label: t.seller.offers.stock.out };
  if (offer.lowStock) return { tone: 'warning', label: t.seller.offers.stock.low };
  return { tone: 'success', label: t.seller.offers.stock.inStock };
}
