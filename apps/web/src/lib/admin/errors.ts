import { adminFa } from '@/i18n/admin-fa';
import { errorMessage } from '@/lib/api/error-message';
import { ApiError } from '@/lib/api/errors';

/**
 * Maps an API failure to Persian copy for the admin panel, preferring the
 * admin-specific catalogue and falling back to the shared mapping.
 */
export function adminErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status !== 0) {
    const known = adminFa.errors[error.code];
    if (known) return known;
  }
  return errorMessage(error);
}
