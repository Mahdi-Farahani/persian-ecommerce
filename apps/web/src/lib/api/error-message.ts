import { t } from '@/i18n';
import { ApiError } from './errors';

/**
 * Maps an API failure to a Persian message suitable for display, preferring
 * the localized catalogue over the raw server message.
 */
export function errorMessage(error: unknown, fallback = t.common.unexpectedError): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return t.common.networkError;
    const known = t.auth.errors[error.code];
    if (known) return known;
    if (error.status === 429) return t.auth.errors['RATE_LIMITED'] ?? fallback;
    const validation = error.validationMessages;
    if (validation.length > 0) return validation.join('؛ ');
    return error.message || fallback;
  }
  return fallback;
}
