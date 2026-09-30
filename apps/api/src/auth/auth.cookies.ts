import type { CookieOptions, Response } from 'express';
import type { AuthConfig } from '../config/app-config.service.js';

export const ACCESS_COOKIE = 'pe_access';
export const REFRESH_COOKIE = 'pe_refresh';

const DAY_MS = 86_400_000;
const SECOND_MS = 1_000;

function baseOptions(config: AuthConfig): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    domain: config.cookieDomain,
    path: '/',
  };
}

export function setAuthCookies(
  res: Response,
  config: AuthConfig,
  tokens: { accessToken: string; refreshToken: string },
): void {
  const base = baseOptions(config);
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...base,
    maxAge: config.accessTtlSeconds * SECOND_MS,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...base,
    maxAge: config.refreshTtlDays * DAY_MS,
  });
}

export function clearAuthCookies(res: Response, config: AuthConfig): void {
  const base = baseOptions(config);
  res.clearCookie(ACCESS_COOKIE, base);
  res.clearCookie(REFRESH_COOKIE, base);
}
