import 'server-only';
import { cookies, headers } from 'next/headers';
import { env } from '@/lib/env';
import { request, type RequestOptions } from './client';

/**
 * API client for Server Components, Route Handlers and Server Actions.
 * Forwards the visitor's cookies so authenticated requests work server side,
 * and talks to the API over the internal network.
 */
async function forwardedHeaders(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const incoming = await headers();
  const result: Record<string, string> = {};
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join('; ');
  if (cookieHeader) result['Cookie'] = cookieHeader;
  const requestId = incoming.get('x-request-id');
  if (requestId) result['X-Request-Id'] = requestId;
  const forwardedFor = incoming.get('x-forwarded-for');
  if (forwardedFor) result['X-Forwarded-For'] = forwardedFor;
  return result;
}

export async function serverApi<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const extra = await forwardedHeaders();
  return request<T>(env.internalApiUrl, path, {
    ...options,
    headers: { ...extra, ...options.headers },
  });
}

/** Fetch that may be cached (no cookies forwarded) for public catalogue data. */
export async function publicApi<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return request<T>(env.internalApiUrl, path, options);
}
