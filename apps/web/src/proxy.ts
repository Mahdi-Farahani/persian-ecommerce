import { type NextRequest, NextResponse } from 'next/server';

const ACCESS_COOKIE = 'pe_access';
const REFRESH_COOKIE = 'pe_refresh';
const PROTECTED_PREFIXES = ['/account', '/checkout', '/payment', '/admin', '/seller'];
const GUEST_ONLY_PATHS = ['/login', '/register'];

function internalApiUrl(): string {
  return (process.env.API_INTERNAL_URL ?? 'http://localhost:4000/api/v1').replace(/\/+$/, '');
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function safeNextPath(request: NextRequest): string {
  const { pathname, search } = request.nextUrl;
  return `${pathname}${search}`;
}

interface RefreshResult {
  accessToken: string;
  setCookies: string[];
}

/**
 * Exchanges the refresh cookie for a new access token so Server Components
 * receive a valid credential on the very first request after expiry.
 */
async function refreshWithApi(refreshToken: string): Promise<RefreshResult | null> {
  try {
    const response = await fetch(`${internalApiUrl()}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'proxy',
        Cookie: `${REFRESH_COOKIE}=${encodeURIComponent(refreshToken)}`,
      },
      body: '{}',
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { accessToken?: string };
    if (!data.accessToken) return null;
    return { accessToken: data.accessToken, setCookies: response.headers.getSetCookie() };
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

  let authenticated = Boolean(access);
  let response: NextResponse | null = null;

  if (!access && refresh) {
    const refreshed = await refreshWithApi(refresh);
    if (refreshed) {
      // Forward the fresh access token to the downstream render and persist
      // the rotated cookies in the browser.
      const headers = new Headers(request.headers);
      const existing = headers.get('cookie') ?? '';
      headers.set(
        'cookie',
        `${existing ? `${existing}; ` : ''}${ACCESS_COOKIE}=${refreshed.accessToken}`,
      );
      response = NextResponse.next({ request: { headers } });
      for (const cookie of refreshed.setCookies) response.headers.append('set-cookie', cookie);
      authenticated = true;
    } else {
      response = NextResponse.next();
      response.cookies.delete(REFRESH_COOKIE);
      response.cookies.delete(ACCESS_COOKIE);
    }
  }

  if (isProtected(pathname) && !authenticated) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('next', safeNextPath(request));
    const redirect = NextResponse.redirect(loginUrl);
    if (refresh && !authenticated) {
      // The refresh token was rejected: drop stale cookies so the login page
      // is reachable and no redirect loop can occur.
      redirect.cookies.delete(REFRESH_COOKIE);
      redirect.cookies.delete(ACCESS_COOKIE);
    }
    return redirect;
  }

  if (GUEST_ONLY_PATHS.includes(pathname) && authenticated) {
    const home = request.nextUrl.clone();
    home.pathname = '/account';
    home.search = '';
    return NextResponse.redirect(home);
  }

  return response ?? NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|healthz|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?)$).*)',
  ],
};
