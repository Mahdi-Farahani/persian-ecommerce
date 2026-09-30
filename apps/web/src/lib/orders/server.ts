import 'server-only';
import type { OrderDetail, OrderSummary, Paginated, PaymentView } from '@pe/shared';
import { cache } from 'react';
import { ApiError } from '@/lib/api/errors';
import { serverApi } from '@/lib/api/server';

const noStore = { cache: 'no-store' as const };

export function listMyOrders(page: number, limit: number): Promise<Paginated<OrderSummary>> {
  return serverApi<Paginated<OrderSummary>>('/orders', { query: { page, limit }, ...noStore });
}

/** Resolves to null when the order does not exist or belongs to someone else. */
export async function getMyOrder(id: string): Promise<OrderDetail | null> {
  try {
    return await serverApi<OrderDetail>(`/orders/${encodeURIComponent(id)}`, noStore);
  } catch (error) {
    if (error instanceof ApiError && (error.isNotFound || error.status === 403)) return null;
    throw error;
  }
}

/**
 * Resolves to null when the payment does not exist or belongs to someone else.
 * Memoised per request so the page body and its metadata share one call.
 */
export const getMyPayment = cache(async (id: string): Promise<PaymentView | null> => {
  try {
    return await serverApi<PaymentView>(`/payments/${encodeURIComponent(id)}`, noStore);
  } catch (error) {
    if (error instanceof ApiError && (error.isNotFound || error.status === 403)) return null;
    throw error;
  }
});
