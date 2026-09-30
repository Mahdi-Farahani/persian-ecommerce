import 'server-only';
import type { AuthUser } from '@pe/shared';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { ApiError } from '@/lib/api/errors';
import { serverApi } from '@/lib/api/server';

/**
 * Resolves the current user for this request (memoised per request).
 * Returns null for anonymous visitors or invalid sessions.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  try {
    return await serverApi<AuthUser>('/auth/me', { cache: 'no-store' });
  } catch (error) {
    if (error instanceof ApiError && (error.isUnauthorized || error.status === 403)) {
      return null;
    }
    if (error instanceof ApiError && error.status === 0) {
      // API unreachable: render as anonymous rather than failing the page.
      return null;
    }
    throw error;
  }
});

/** Redirects to the login page when the visitor is not authenticated. */
export async function requireUser(nextPath: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return user;
}
