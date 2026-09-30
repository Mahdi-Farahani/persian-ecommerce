import { env } from '@/lib/env';
import { ApiError } from './errors';

export type QueryValue = string | number | boolean | undefined | null | Array<string | number>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  headers?: Record<string, string>;
  /** Next.js fetch cache hints (server side only). */
  next?: { revalidate?: number | false; tags?: string[] };
  cache?: RequestCache;
  signal?: AbortSignal;
}

function buildUrl(base: string, path: string, query?: Record<string, QueryValue>): string {
  const normalizedBase = base.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${normalizedBase}${normalizedPath}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item));
    } else {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  const text = await response.text();
  return text.length > 0 ? text : undefined;
}

export async function request<T>(
  base: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    // Custom header doubles as the CSRF token for cookie-authenticated calls.
    'X-Requested-With': 'fetch',
    ...options.headers,
  };
  let body: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  const init: RequestInit & { next?: RequestOptions['next'] } = {
    method: options.method ?? 'GET',
    headers,
    body,
    credentials: 'include',
    signal: options.signal,
  };
  if (options.cache) init.cache = options.cache;
  if (options.next) init.next = options.next;

  let response: Response;
  try {
    response = await fetch(buildUrl(base, path, options.query), init);
  } catch (error) {
    throw new ApiError(0, 'NETWORK_ERROR', 'ارتباط با سرور برقرار نشد', error);
  }
  const payload = await parseBody(response);
  if (!response.ok) {
    throw ApiError.fromBody(response.status, payload);
  }
  return payload as T;
}

// ---------------------------------------------------------------------------
// Browser client with transparent access-token refresh
// ---------------------------------------------------------------------------

const AUTH_PATHS_WITHOUT_RETRY = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

let refreshInFlight: Promise<boolean> | null = null;

/** Rotates the session via the refresh cookie; concurrent callers share one request. */
async function refreshSession(): Promise<boolean> {
  refreshInFlight ??= request<unknown>(env.publicApiUrl, '/auth/refresh', {
    method: 'POST',
    body: {},
  })
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

async function browserRequest<T>(path: string, options: RequestOptions): Promise<T> {
  try {
    return await request<T>(env.publicApiUrl, path, options);
  } catch (error) {
    const retryable =
      error instanceof ApiError &&
      error.isUnauthorized &&
      !AUTH_PATHS_WITHOUT_RETRY.some((p) => path.startsWith(p));
    if (!retryable) throw error;
    const refreshed = await refreshSession();
    if (!refreshed) throw error;
    return request<T>(env.publicApiUrl, path, options);
  }
}

/** API client for browser (Client Components). Cookies are sent automatically. */
export const browserApi = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    browserRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    browserRequest<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    browserRequest<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    browserRequest<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    browserRequest<T>(path, { ...options, method: 'DELETE' }),
};
