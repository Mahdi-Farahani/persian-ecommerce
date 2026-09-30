/**
 * URL slug helpers that keep Persian letters intact (modern browsers and
 * search engines handle percent-encoded Unicode paths correctly) while
 * removing characters that are unsafe or meaningless in URLs.
 */

const UNSAFE = /[^\p{L}\p{N}‌-]+/gu;

export function slugify(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(UNSAFE, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

export const SLUG_REGEX = /^[\p{L}\p{N}‌]+(?:-[\p{L}\p{N}‌]+)*$/u;

export function isValidSlug(value: string): boolean {
  return value.length > 0 && value.length <= 180 && SLUG_REGEX.test(value);
}
