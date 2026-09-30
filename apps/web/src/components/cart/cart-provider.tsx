'use client';

import type { CartView } from '@pe/shared';
import { useEffect, type ReactNode } from 'react';
import { useCartStore } from '@/store/cart-store';

/**
 * Seeds the cart store with the server-rendered cart (cookies are forwarded
 * by the layout) so the header badge is correct on first paint.
 */
export function CartProvider({
  initialCart,
  children,
}: {
  initialCart: CartView | null;
  children: ReactNode;
}) {
  const setCart = useCartStore((state) => state.setCart);
  useEffect(() => {
    setCart(initialCart);
  }, [initialCart, setCart]);
  return children;
}
