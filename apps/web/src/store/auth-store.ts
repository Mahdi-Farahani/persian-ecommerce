import type { AuthUser } from '@pe/shared';
import { create } from 'zustand';

interface AuthState {
  user: AuthUser | null;
  /** True once the server-provided initial state has been applied. */
  hydrated: boolean;
  setUser: (user: AuthUser | null) => void;
  hydrate: (user: AuthUser | null) => void;
}

/**
 * Client-side mirror of the authenticated principal. The backend remains the
 * source of truth; this store only exists so client components can render
 * auth-aware UI without refetching on every navigation.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  hydrated: false,
  setUser: (user) => set({ user }),
  hydrate: (user) => set({ user, hydrated: true }),
}));
