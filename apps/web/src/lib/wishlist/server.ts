import 'server-only';
import type { WishlistView } from '@pe/shared';
import { serverApi } from '@/lib/api/server';

/** The signed-in user's wishlist with full product cards. */
export function getWishlist(): Promise<WishlistView> {
  return serverApi<WishlistView>('/wishlist', { cache: 'no-store' });
}
