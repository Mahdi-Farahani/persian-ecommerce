import 'server-only';
import type { CartView } from '@pe/shared';
import { serverApi } from '@/lib/api/server';

/** Current visitor's cart (guest cookie or user); null when the API is unreachable. */
export async function getCart(): Promise<CartView | null> {
  try {
    return await serverApi<CartView>('/cart', { cache: 'no-store' });
  } catch {
    return null;
  }
}
