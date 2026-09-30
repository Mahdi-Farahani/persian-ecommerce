/**
 * Runtime environment for the web app.
 *
 * - `publicApiUrl`  : base URL the browser uses (same origin through nginx).
 * - `internalApiUrl`: base URL the Next.js server uses (docker network).
 *
 * Only NEXT_PUBLIC_* values are ever inlined into the browser bundle.
 */
const DEFAULT_PUBLIC_API_URL = '/api/v1';
const DEFAULT_INTERNAL_API_URL = 'http://localhost:4000/api/v1';

export const env = {
  publicApiUrl: process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_PUBLIC_API_URL,
  internalApiUrl: process.env.API_INTERNAL_URL ?? DEFAULT_INTERNAL_API_URL,
  appUrl: process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  isProduction: process.env.NODE_ENV === 'production',
} as const;
