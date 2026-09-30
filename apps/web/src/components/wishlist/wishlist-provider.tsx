'use client';

import { useEffect, type ReactNode } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useWishlistStore } from '@/store/wishlist-store';

/**
 * Loads the wishlist id list once the auth store is hydrated with a user and
 * clears it when the user signs out. Guests never trigger a request.
 */
export function WishlistProvider({ children }: { children: ReactNode }) {
  const hydrated = useAuthStore((state) => state.hydrated);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const load = useWishlistStore((state) => state.load);
  const reset = useWishlistStore((state) => state.reset);

  useEffect(() => {
    if (!hydrated) return;
    if (userId) {
      void load();
    } else {
      reset();
    }
  }, [hydrated, userId, load, reset]);

  return children;
}
