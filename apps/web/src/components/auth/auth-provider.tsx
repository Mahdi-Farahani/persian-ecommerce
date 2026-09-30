'use client';

import type { AuthUser } from '@pe/shared';
import { useEffect, type ReactNode } from 'react';
import { useAuthStore } from '@/store/auth-store';

interface AuthProviderProps {
  initialUser: AuthUser | null;
  children: ReactNode;
}

/**
 * Seeds the auth store with the user resolved on the server for this request.
 */
export function AuthProvider({ initialUser, children }: AuthProviderProps) {
  const hydrate = useAuthStore((state) => state.hydrate);
  useEffect(() => {
    hydrate(initialUser);
  }, [hydrate, initialUser]);
  return children;
}
