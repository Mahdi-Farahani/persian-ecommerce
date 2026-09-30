import type { CartView, WishlistView } from '@pe/shared';
import { create } from 'zustand';
import { browserApi } from '@/lib/api/client';
import { useAuthStore } from './auth-store';
import { useCartStore } from './cart-store';

export interface MoveToCartResult {
  cart: CartView;
  wishlist: WishlistView;
}

interface WishlistState {
  /** Product ids currently in the wishlist (only meaningful for signed-in users). */
  ids: string[];
  loading: boolean;
  /** Set after the first successful load (or a reset for guests). */
  loaded: boolean;
  /** Fetches the id list; a no-op for guests (the wishlist requires a session). */
  load: () => Promise<void>;
  /** Clears local state, e.g. after logout. */
  reset: () => void;
  /** Replaces the id list from a full wishlist payload. */
  setFromView: (view: WishlistView) => void;
  /** Adds or removes optimistically; resolves to true when the product was added. Rolls back on failure. */
  toggle: (productId: string) => Promise<boolean>;
  remove: (productId: string) => Promise<WishlistView>;
  /** Moves a product to the cart; the cart store is updated with the returned cart. */
  moveToCart: (productId: string) => Promise<MoveToCartResult>;
}

function idsOf(view: WishlistView): string[] {
  return view.items.map((item) => item.productId);
}

function encode(productId: string): string {
  return encodeURIComponent(productId);
}

/**
 * Client-side mirror of the user's wishlist membership. Only the id list is
 * kept globally (for heart buttons and the header badge); full item data is
 * loaded by the wishlist page itself.
 */
export const useWishlistStore = create<WishlistState>()((set, get) => ({
  ids: [],
  loading: false,
  loaded: false,
  load: async () => {
    if (!useAuthStore.getState().user) {
      set({ ids: [], loaded: true, loading: false });
      return;
    }
    set({ loading: true });
    try {
      const ids = await browserApi.get<string[]>('/wishlist/ids');
      set({ ids, loaded: true, loading: false });
    } catch {
      set({ loading: false, loaded: true });
    }
  },
  reset: () => set({ ids: [], loaded: true, loading: false }),
  setFromView: (view) => set({ ids: idsOf(view), loaded: true }),
  toggle: async (productId) => {
    const previous = get().ids;
    const inList = previous.includes(productId);
    set({ ids: inList ? previous.filter((id) => id !== productId) : [...previous, productId] });
    try {
      const view = inList
        ? await browserApi.delete<WishlistView>(`/wishlist/${encode(productId)}`)
        : await browserApi.post<WishlistView>(`/wishlist/${encode(productId)}`, {});
      set({ ids: idsOf(view), loaded: true });
      return !inList;
    } catch (error) {
      set({ ids: previous });
      throw error;
    }
  },
  remove: async (productId) => {
    const view = await browserApi.delete<WishlistView>(`/wishlist/${encode(productId)}`);
    set({ ids: idsOf(view), loaded: true });
    return view;
  },
  moveToCart: async (productId) => {
    const result = await browserApi.post<MoveToCartResult>(
      `/wishlist/${encode(productId)}/move-to-cart`,
      {},
    );
    useCartStore.getState().setCart(result.cart);
    set({ ids: idsOf(result.wishlist), loaded: true });
    return result;
  },
}));

export const selectWishlistCount = (state: WishlistState): number => state.ids.length;
