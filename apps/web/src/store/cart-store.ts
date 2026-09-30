import type { CartView } from '@pe/shared';
import { create } from 'zustand';
import { browserApi } from '@/lib/api/client';

interface CartState {
  cart: CartView | null;
  loading: boolean;
  /** Set after the first successful load (or a failed one for guests without a cart). */
  loaded: boolean;
  load: () => Promise<void>;
  setCart: (cart: CartView | null) => void;
  add: (variantId: string, quantity?: number) => Promise<CartView>;
  update: (itemId: string, quantity: number) => Promise<CartView>;
  remove: (itemId: string) => Promise<CartView>;
  clear: () => Promise<CartView>;
  applyCoupon: (code: string) => Promise<CartView>;
  removeCoupon: () => Promise<CartView>;
}

/**
 * Client-side mirror of the server cart. Every action calls the API and
 * replaces the local copy with the authoritative response; totals are never
 * computed in the browser.
 */
export const useCartStore = create<CartState>()((set) => {
  const commit = (cart: CartView): CartView => {
    set({ cart, loading: false, loaded: true });
    return cart;
  };
  return {
    cart: null,
    loading: false,
    loaded: false,
    setCart: (cart) => set({ cart, loaded: true }),
    load: async () => {
      set({ loading: true });
      try {
        commit(await browserApi.get<CartView>('/cart'));
      } catch {
        set({ loading: false, loaded: true });
      }
    },
    add: async (variantId, quantity = 1) =>
      commit(await browserApi.post<CartView>('/cart/items', { variantId, quantity })),
    update: async (itemId, quantity) =>
      commit(await browserApi.patch<CartView>(`/cart/items/${itemId}`, { quantity })),
    remove: async (itemId) => commit(await browserApi.delete<CartView>(`/cart/items/${itemId}`)),
    clear: async () => commit(await browserApi.delete<CartView>('/cart')),
    applyCoupon: async (code) => commit(await browserApi.post<CartView>('/cart/coupon', { code })),
    removeCoupon: async () => commit(await browserApi.delete<CartView>('/cart/coupon')),
  };
});

export const selectItemCount = (state: CartState): number => state.cart?.totals.itemCount ?? 0;
