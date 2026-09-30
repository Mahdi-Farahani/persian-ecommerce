import type { AuthResponse } from '@pe/shared';
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from '../global-setup.js';
import type { TestApp } from './test-app.js';

let counter = 0;

export function uniqueEmail(prefix = 'user'): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}@test.local`;
}

export const CSRF_HEADER = { 'X-Requested-With': 'test' };

export async function registerUser(
  ctx: TestApp,
  overrides: Partial<{
    email: string;
    phone: string;
    password: string;
    firstName: string;
    lastName: string;
  }> = {},
): Promise<AuthResponse> {
  const payload = {
    email: overrides.email ?? uniqueEmail(),
    password: overrides.password ?? 'Passw0rd!123',
    firstName: overrides.firstName ?? 'کاربر',
    lastName: overrides.lastName ?? 'آزمایشی',
    ...(overrides.phone ? { phone: overrides.phone } : {}),
  };
  const res = await ctx.http().post('/api/v1/auth/register').send(payload).expect(201);
  return res.body as AuthResponse;
}

export async function loginAs(
  ctx: TestApp,
  identifier: string,
  password: string,
): Promise<AuthResponse> {
  const res = await ctx
    .http()
    .post('/api/v1/auth/login')
    .send({ identifier, password })
    .expect(200);
  return res.body as AuthResponse;
}

export async function loginAsAdmin(ctx: TestApp): Promise<AuthResponse> {
  return loginAs(ctx, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
}

export function bearer(auth: AuthResponse): { Authorization: string } {
  return { Authorization: `Bearer ${auth.accessToken}` };
}
