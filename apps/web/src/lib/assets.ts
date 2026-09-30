/**
 * Resolves a stored asset path (e.g. `/uploads/catalog/x.webp`) to a URL.
 *
 * Uploads are always addressed relative to the web origin: nginx serves
 * `/uploads/` from the API in production and `next.config.ts` rewrites the
 * same path to the API in development, so one URL shape works everywhere
 * (including the Next.js image optimizer, which only trusts same-origin
 * relative sources).
 */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return path.startsWith('/') ? path : `/${path}`;
}
