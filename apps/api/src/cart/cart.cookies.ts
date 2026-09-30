import { createHash, randomBytes } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import type { AuthConfig } from '../config/app-config.service.js';

export const CART_COOKIE = 'pe_cart';
const GUEST_CART_TTL_DAYS = 30;
const DAY_MS = 86_400_000;

export function readCartToken(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  const token = cookies?.[CART_COOKIE];
  return token && /^[A-Za-z0-9_-]{20,128}$/.test(token) ? token : undefined;
}

export function newCartToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashCartToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function options(config: AuthConfig): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    domain: config.cookieDomain,
    path: '/',
    maxAge: GUEST_CART_TTL_DAYS * DAY_MS,
  };
}

export function setCartCookie(res: Response, config: AuthConfig, token: string): void {
  res.cookie(CART_COOKIE, token, options(config));
}

export function clearCartCookie(res: Response, config: AuthConfig): void {
  res.clearCookie(CART_COOKIE, { ...options(config), maxAge: undefined });
}

export const GUEST_CART_TTL_MS = GUEST_CART_TTL_DAYS * DAY_MS;
