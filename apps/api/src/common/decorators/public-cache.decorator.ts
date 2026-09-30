import { applyDecorators, Header } from '@nestjs/common';

/** Seconds a public catalogue response may be reused by browsers and CDNs. */
export const PUBLIC_CACHE_SECONDS = 60;
const STALE_WHILE_REVALIDATE_SECONDS = 300;

/**
 * Marks an anonymous, user-independent GET response as cacheable. Only use
 * on endpoints whose output never depends on the caller (no cookies read).
 */
export function PublicCache(maxAge = PUBLIC_CACHE_SECONDS): MethodDecorator & ClassDecorator {
  return applyDecorators(
    Header(
      'Cache-Control',
      `public, max-age=${maxAge}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`,
    ),
    Header('Vary', 'Accept-Encoding'),
  );
}
