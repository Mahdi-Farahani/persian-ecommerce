import { isValidSlug, slugify } from '@pe/shared';
import { UnprocessableAppException } from '../errors/app.exception.js';

/**
 * Resolves the slug for a new/updated record: an explicit slug is validated,
 * otherwise one is generated from `source`. `exists` reports collisions and a
 * numeric suffix is appended until the slug is unique.
 */
export async function resolveUniqueSlug(
  explicit: string | undefined,
  source: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  if (explicit !== undefined) {
    const trimmed = explicit.trim();
    if (!isValidSlug(trimmed)) {
      throw new UnprocessableAppException('SLUG_INVALID', 'نامک (slug) معتبر نیست');
    }
    if (await exists(trimmed)) {
      throw new UnprocessableAppException('SLUG_TAKEN', 'این نامک قبلاً استفاده شده است');
    }
    return trimmed;
  }
  const base = slugify(source) || 'item';
  let candidate = base;
  let counter = 2;
  while (await exists(candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  return candidate;
}
