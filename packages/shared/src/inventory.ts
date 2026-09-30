/** Inventory contracts (admin). Quantities are units, never money. */

export const InventoryTransactionTypes = [
  'PURCHASE',
  'RESERVATION',
  'RELEASE',
  'SALE',
  'RETURN',
  'ADJUSTMENT',
] as const;
export type InventoryTransactionType = (typeof InventoryTransactionTypes)[number];

export interface InventorySnapshot {
  variantId: string;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  lowStock: boolean;
  updatedAt: string;
}

/** Row of the admin inventory list: snapshot plus what the variant is. */
export interface InventoryItemView extends InventorySnapshot {
  sku: string;
  variantTitle: string | null;
  variantStatus: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  productStatus: string;
  imageUrl: string | null;
}

export interface InventoryTransactionView {
  id: string;
  type: InventoryTransactionType;
  quantity: number;
  stockAfter: number;
  reservedAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  actorId: string | null;
  createdAt: string;
}

export interface InventorySummary {
  trackedVariants: number;
  lowStockVariants: number;
  outOfStockVariants: number;
  reservedUnits: number;
  stockUnits: number;
}

export const INVENTORY_TRANSACTION_LABELS: Record<InventoryTransactionType, string> = {
  PURCHASE: 'ورود کالا',
  RESERVATION: 'رزرو',
  RELEASE: 'آزادسازی رزرو',
  SALE: 'فروش',
  RETURN: 'مرجوعی',
  ADJUSTMENT: 'اصلاح دستی',
};
