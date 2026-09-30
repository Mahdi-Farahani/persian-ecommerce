import { t } from '@/i18n';
import { errorMessage } from '@/lib/api/error-message';
import { ApiError } from '@/lib/api/errors';

/** Persian message for a seller-portal API failure, preferring marketplace-specific codes. */
export function sellerErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const known = t.seller.errors[error.code];
    if (known) return known;
  }
  return errorMessage(error);
}
