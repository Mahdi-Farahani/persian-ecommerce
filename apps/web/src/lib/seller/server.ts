import 'server-only';
import type {
  Paginated,
  SellerDashboard,
  SellerOfferView,
  SellerOrderView,
  SellerProfileView,
  SellerPublicView,
  SettlementView,
} from '@pe/shared';
import { cache } from 'react';
import type { QueryValue } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { publicApi, serverApi } from '@/lib/api/server';

const noStore = { cache: 'no-store' as const };

export type PublicSellerDetail = SellerPublicView & { description: string | null };

/**
 * The visitor's seller profile/application, or null when they never applied.
 * Memoised per request so the portal layout and its pages share one call.
 */
export const getSellerProfile = cache(async (): Promise<SellerProfileView | null> => {
  const profile = await serverApi<SellerProfileView | null>('/seller/profile', noStore);
  return profile ?? null;
});

/**
 * Resolves the profile only when the seller may use the portal. Pages under
 * `/seller` render nothing otherwise, because the layout already shows the
 * status notice (or redirected to the application page).
 */
export async function getApprovedSeller(): Promise<SellerProfileView | null> {
  const profile = await getSellerProfile();
  return profile?.status === 'APPROVED' ? profile : null;
}

export function getSellerDashboard(): Promise<SellerDashboard> {
  return serverApi<SellerDashboard>('/seller/dashboard', noStore);
}

export function listSellerOffers(
  query: Record<string, QueryValue>,
): Promise<Paginated<SellerOfferView>> {
  return serverApi<Paginated<SellerOfferView>>('/seller/products', { query, ...noStore });
}

export function listSellerOrders(
  query: Record<string, QueryValue>,
): Promise<Paginated<SellerOrderView>> {
  return serverApi<Paginated<SellerOrderView>>('/seller/orders', { query, ...noStore });
}

/** Resolves to null when the order does not exist or contains none of the seller's items. */
export async function getSellerOrder(id: string): Promise<SellerOrderView | null> {
  try {
    return await serverApi<SellerOrderView>(`/seller/orders/${encodeURIComponent(id)}`, noStore);
  } catch (error) {
    if (error instanceof ApiError && (error.isNotFound || error.status === 403)) return null;
    throw error;
  }
}

export function listSellerSettlements(
  query: Record<string, QueryValue>,
): Promise<Paginated<SettlementView>> {
  return serverApi<Paginated<SettlementView>>('/seller/settlements', { query, ...noStore });
}

const SELLER_PAGE_REVALIDATE_SECONDS = 60;

/** Public storefront identity of an approved seller; null when unknown. */
export const getPublicSeller = cache(async (slug: string): Promise<PublicSellerDetail | null> => {
  try {
    return await publicApi<PublicSellerDetail>(`/sellers/${encodeURIComponent(slug)}`, {
      next: { revalidate: SELLER_PAGE_REVALIDATE_SECONDS, tags: ['sellers'] },
    });
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) return null;
    throw error;
  }
});
