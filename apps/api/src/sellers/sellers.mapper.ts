import {
  formatOrderNumber,
  maskIban,
  type AdminSellerView,
  type AdminSettlementView,
  type SellerOrderView,
  type SellerProfileView,
  type SellerPublicView,
  type SettlementView,
} from '@pe/shared';
import { money, moneyOrNull } from '../common/utils/money.util.js';
import type { Prisma, Seller, Settlement } from '../generated/prisma/client.js';

export const sellerPublicSelect = { id: true, storeName: true, slug: true } as const;

export function toSellerPublic(seller: {
  id: string;
  storeName: string;
  slug: string;
}): SellerPublicView {
  return { id: seller.id, storeName: seller.storeName, slug: seller.slug };
}

export function toSellerProfile(seller: Seller): SellerProfileView {
  return {
    id: seller.id,
    storeName: seller.storeName,
    slug: seller.slug,
    description: seller.description,
    status: seller.status,
    commissionBps: seller.commissionBps,
    contactPhone: seller.contactPhone,
    contactEmail: seller.contactEmail,
    legalName: seller.legalName,
    nationalId: seller.nationalId,
    ibanMasked: maskIban(seller.iban),
    province: seller.province,
    city: seller.city,
    addressLine: seller.addressLine,
    rejectionReason: seller.rejectionReason,
    approvedAt: seller.approvedAt?.toISOString() ?? null,
    createdAt: seller.createdAt.toISOString(),
  };
}

export const adminSellerInclude = {
  user: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
  _count: { select: { variants: true } },
} satisfies Prisma.SellerInclude;
export type AdminSellerRow = Prisma.SellerGetPayload<{ include: typeof adminSellerInclude }>;

export function toAdminSeller(
  row: AdminSellerRow,
  pendingSettlementAmount: number,
): AdminSellerView {
  const user = row.user;
  return {
    ...toSellerProfile(row),
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name:
        [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || user.phone || '',
    },
    offerCount: row._count.variants,
    pendingSettlementAmount,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toSettlement(row: Settlement): SettlementView {
  return {
    id: row.id,
    sellerId: row.sellerId,
    status: row.status,
    grossAmount: money(row.grossAmount),
    commissionAmount: money(row.commissionAmount),
    netAmount: money(row.netAmount),
    itemCount: row.itemCount,
    periodStart: row.periodStart?.toISOString() ?? null,
    periodEnd: row.periodEnd?.toISOString() ?? null,
    note: row.note,
    paymentReference: row.paymentReference,
    paidAt: row.paidAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toAdminSettlement(
  row: Settlement & { seller: { id: string; storeName: string; slug: string } },
): AdminSettlementView {
  return { ...toSettlement(row), seller: toSellerPublic(row.seller) };
}

export const sellerOrderInclude = {
  items: { orderBy: { id: 'asc' }, include: { seller: { select: sellerPublicSelect } } },
  shipments: {
    include: { tracking: { orderBy: { occurredAt: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.OrderInclude;
export type SellerOrderRow = Prisma.OrderGetPayload<{ include: typeof sellerOrderInclude }>;

/** Projects an order onto what one seller may see: their items and shipments only. */
export function toSellerOrder(row: SellerOrderRow, sellerId: string): SellerOrderView {
  const items = row.items.filter((i) => i.sellerId === sellerId);
  const shipments = row.shipments.filter((s) => s.sellerId === sellerId);
  const itemsTotal = items.reduce((sum, i) => sum + money(i.lineTotal), 0);
  const sellerTotal = items.reduce((sum, i) => sum + money(i.sellerAmount), 0);
  const fulfillable = ['PAID', 'PROCESSING', 'PACKED'].includes(row.status);
  return {
    id: row.id,
    number: formatOrderNumber(row.number),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    paidAt: row.paidAt?.toISOString() ?? null,
    address: {
      recipientName: row.recipientName,
      recipientPhone: row.recipientPhone,
      province: row.province,
      city: row.city,
      addressLine: row.addressLine,
      postalCode: row.postalCode,
    },
    shippingMethodName: row.shippingMethodName,
    customerNote: row.customerNote,
    items: items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      productId: item.productId,
      productTitle: item.productTitle,
      productSlug: item.productSlug,
      variantTitle: item.variantTitle,
      sku: item.sku,
      imageUrl: item.imageUrl,
      unitPrice: money(item.unitPrice),
      compareAtPrice: moneyOrNull(item.compareAtPrice),
      quantity: item.quantity,
      lineTotal: money(item.lineTotal),
      seller: item.seller ? toSellerPublic(item.seller) : null,
      commissionAmount: money(item.commissionAmount),
      sellerAmount: money(item.sellerAmount),
      settlementId: item.settlementId,
    })),
    shipments: shipments.map((s) => ({
      id: s.id,
      sellerId: s.sellerId,
      carrier: s.carrier,
      trackingCode: s.trackingCode,
      shippedAt: s.shippedAt?.toISOString() ?? null,
      deliveredAt: s.deliveredAt?.toISOString() ?? null,
      events: s.tracking.map((t) => ({
        id: t.id,
        status: t.status,
        description: t.description,
        occurredAt: t.occurredAt.toISOString(),
      })),
    })),
    itemsTotal,
    sellerTotal,
    awaitingShipment: fulfillable && items.length > 0 && shipments.length === 0,
  };
}
