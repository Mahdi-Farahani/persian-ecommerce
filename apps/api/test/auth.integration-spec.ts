import { TokenService } from '../src/auth/token.service.js';
import {
  bearer,
  CSRF_HEADER,
  loginAs,
  loginAsAdmin,
  registerUser,
  uniqueEmail,
} from './utils/auth-helpers.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

function cookiesOf(res: { headers: Record<string, string | string[] | undefined> }): string[] {
  const raw = res.headers['set-cookie'];
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
}

describe('Authentication (integration)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('registration', () => {
    it('creates a customer and returns tokens + cookies', async () => {
      const email = uniqueEmail('reg');
      const res = await ctx
        .http()
        .post('/api/v1/auth/register')
        .send({ email, password: 'Passw0rd!123', firstName: 'سارا', lastName: 'احمدی' })
        .expect(201);
      expect(res.body.user).toMatchObject({ email, roles: ['CUSTOMER'], firstName: 'سارا' });
      expect(res.body.accessToken).toBeTypeOf('string');
      expect(res.body.refreshToken).toBeTypeOf('string');
      const cookies = cookiesOf(res);
      expect(cookies.some((c) => c.startsWith('pe_access=') && /HttpOnly/i.test(c))).toBe(true);
      expect(cookies.some((c) => c.startsWith('pe_refresh=') && /HttpOnly/i.test(c))).toBe(true);
    });

    it('accepts an Iranian mobile number instead of email', async () => {
      const phone = `0912${String(Date.now()).slice(-7)}`;
      const res = await ctx
        .http()
        .post('/api/v1/auth/register')
        .send({ phone: `+98 ${phone.slice(1, 4)} ${phone.slice(4)}`, password: 'Passw0rd!123' })
        .expect(201);
      expect(res.body.user.phone).toBe(phone);
      expect(res.body.user.email).toBeNull();
    });

    it('rejects duplicate accounts', async () => {
      const email = uniqueEmail('dup');
      await registerUser(ctx, { email });
      const res = await ctx
        .http()
        .post('/api/v1/auth/register')
        .send({ email, password: 'Passw0rd!123' })
        .expect(409);
      expect(res.body.error.code).toBe('EMAIL_TAKEN');
    });

    it('validates the payload', async () => {
      const res = await ctx
        .http()
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', password: 'short', extra: 'nope' })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.length).toBeGreaterThan(0);
    });

    it('never exposes password hashes', async () => {
      const auth = await registerUser(ctx);
      const res = await ctx.http().get('/api/v1/auth/me').set(bearer(auth)).expect(200);
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|argon2/);
    });
  });

  describe('login', () => {
    it('signs in with email and with phone', async () => {
      const email = uniqueEmail('login');
      const phone = `0935${String(Date.now()).slice(-7)}`;
      await registerUser(ctx, { email, phone, password: 'Passw0rd!123' });
      const byEmail = await loginAs(ctx, email.toUpperCase(), 'Passw0rd!123');
      expect(byEmail.user.email).toBe(email);
      const byPhone = await loginAs(ctx, `۰${phone.slice(1)}`, 'Passw0rd!123');
      expect(byPhone.user.id).toBe(byEmail.user.id);
    });

    it('rejects wrong passwords with a generic error', async () => {
      const email = uniqueEmail('badpw');
      await registerUser(ctx, { email });
      const res = await ctx
        .http()
        .post('/api/v1/auth/login')
        .send({ identifier: email, password: 'Wrong-Passw0rd' })
        .expect(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('returns the same error for unknown identifiers', async () => {
      const res = await ctx
        .http()
        .post('/api/v1/auth/login')
        .send({ identifier: 'ghost@test.local', password: 'Whatever1' })
        .expect(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('locks the account after repeated failures', async () => {
      const email = uniqueEmail('lock');
      await registerUser(ctx, { email });
      for (let i = 0; i < 4; i += 1) {
        await ctx
          .http()
          .post('/api/v1/auth/login')
          .send({ identifier: email, password: 'Wrong-1' })
          .expect(401);
      }
      const locked = await ctx
        .http()
        .post('/api/v1/auth/login')
        .send({ identifier: email, password: 'Wrong-1' });
      expect(locked.status).toBe(423);
      expect(locked.body.error.code).toBe('ACCOUNT_LOCKED');
      // Even the right password is rejected while locked.
      const stillLocked = await ctx
        .http()
        .post('/api/v1/auth/login')
        .send({ identifier: email, password: 'Passw0rd!123' });
      expect(stillLocked.status).toBe(423);
    });
  });

  describe('sessions', () => {
    it('authenticates with bearer token and with cookies', async () => {
      const auth = await registerUser(ctx);
      await ctx.http().get('/api/v1/auth/me').set(bearer(auth)).expect(200);
      const viaCookie = await ctx
        .http()
        .get('/api/v1/auth/me')
        .set('Cookie', [`pe_access=${auth.accessToken}`])
        .expect(200);
      expect(viaCookie.body.id).toBe(auth.user.id);
    });

    it('rejects missing, malformed and forged tokens', async () => {
      await ctx.http().get('/api/v1/auth/me').expect(401);
      await ctx.http().get('/api/v1/auth/me').set('Authorization', 'Bearer nope').expect(401);
      const forged =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ4Iiwic2lkIjoieSIsInR5cGUiOiJhY2Nlc3MifQ.invalid';
      await ctx.http().get('/api/v1/auth/me').set('Authorization', `Bearer ${forged}`).expect(401);
    });

    it('requires the CSRF header for cookie-authenticated mutations', async () => {
      const auth = await registerUser(ctx);
      const cookie = [`pe_access=${auth.accessToken}`];
      const blocked = await ctx
        .http()
        .patch('/api/v1/users/me')
        .set('Cookie', cookie)
        .send({ firstName: 'X' })
        .expect(403);
      expect(blocked.body.error.code).toBe('CSRF_CHECK_FAILED');
      await ctx
        .http()
        .patch('/api/v1/users/me')
        .set('Cookie', cookie)
        .set(CSRF_HEADER)
        .send({ firstName: 'X' })
        .expect(200);
      // Bearer tokens are not subject to CSRF (no ambient credential).
      await ctx
        .http()
        .patch('/api/v1/users/me')
        .set(bearer(auth))
        .send({ firstName: 'Y' })
        .expect(200);
    });

    it('rotates refresh tokens, tolerates a short race window and detects late reuse', async () => {
      const auth = await registerUser(ctx);
      const first = await ctx
        .http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: auth.refreshToken })
        .expect(200);
      expect(first.body.refreshToken).not.toBe(auth.refreshToken);
      // Immediately re-presenting the rotated token (concurrent tab) still works.
      const raced = await ctx
        .http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: auth.refreshToken })
        .expect(200);
      expect(raced.body.refreshToken).not.toBe(first.body.refreshToken);
      // Outside the grace window the same token is treated as stolen and poisons the family.
      await ctx.prisma.refreshSession.updateMany({
        where: { tokenHash: TokenService.hashToken(auth.refreshToken) },
        data: { revokedAt: new Date(Date.now() - 120_000) },
      });
      const reuse = await ctx
        .http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: auth.refreshToken })
        .expect(401);
      expect(reuse.body.error.code).toBe('REFRESH_TOKEN_REUSED');
      // ... which also kills the legitimately rotated token and the access token.
      await ctx
        .http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: first.body.refreshToken })
        .expect(401);
      const me = await ctx
        .http()
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${first.body.accessToken}`);
      expect(me.status).toBe(401);
      expect(me.body.error.code).toBe('SESSION_REVOKED');
    });

    it('refreshes from the cookie', async () => {
      const auth = await registerUser(ctx);
      const res = await ctx
        .http()
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`pe_refresh=${auth.refreshToken}`])
        .expect(200);
      expect(cookiesOf(res).some((c) => c.startsWith('pe_access='))).toBe(true);
    });

    it('logout revokes the session and clears cookies', async () => {
      const auth = await registerUser(ctx);
      const res = await ctx.http().post('/api/v1/auth/logout').set(bearer(auth)).expect(204);
      expect(
        cookiesOf(res).some(
          (c) => c.startsWith('pe_access=;') || /pe_access=;|Expires=Thu, 01 Jan 1970/.test(c),
        ),
      ).toBe(true);
      await ctx.http().get('/api/v1/auth/me').set(bearer(auth)).expect(401);
      await ctx
        .http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: auth.refreshToken })
        .expect(401);
    });

    it('logout-all revokes every session', async () => {
      const email = uniqueEmail('all');
      const a = await registerUser(ctx, { email });
      const b = await loginAs(ctx, email, 'Passw0rd!123');
      await ctx.http().post('/api/v1/auth/logout-all').set(bearer(a)).expect(204);
      await ctx.http().get('/api/v1/auth/me').set(bearer(b)).expect(401);
    });
  });

  describe('password management', () => {
    it('changes the password and revokes other sessions', async () => {
      const email = uniqueEmail('chpw');
      const a = await registerUser(ctx, { email });
      const b = await loginAs(ctx, email, 'Passw0rd!123');
      await ctx
        .http()
        .post('/api/v1/auth/change-password')
        .set(bearer(a))
        .send({ currentPassword: 'Wrong-1x', newPassword: 'NewPassw0rd!' })
        .expect(422);
      await ctx
        .http()
        .post('/api/v1/auth/change-password')
        .set(bearer(a))
        .send({ currentPassword: 'Passw0rd!123', newPassword: 'NewPassw0rd!' })
        .expect(204);
      await ctx.http().get('/api/v1/auth/me').set(bearer(a)).expect(200);
      await ctx.http().get('/api/v1/auth/me').set(bearer(b)).expect(401);
      await loginAs(ctx, email, 'NewPassw0rd!');
    });

    it('resets the password through a one-time token', async () => {
      const email = uniqueEmail('reset');
      const auth = await registerUser(ctx, { email });
      await ctx.http().post('/api/v1/auth/forgot-password').send({ identifier: email }).expect(200);
      // Unknown identifiers get the same response.
      await ctx
        .http()
        .post('/api/v1/auth/forgot-password')
        .send({ identifier: 'nobody@test.local' })
        .expect(200);

      // Fetch the raw token the way the notification would deliver it: we only
      // have the hash in the DB, so mint a known token for the test instead.
      const rawToken = 'test-reset-token-' + Date.now();
      await ctx.prisma.passwordResetToken.updateMany({
        where: { userId: auth.user.id },
        data: { usedAt: new Date() },
      });
      await ctx.prisma.passwordResetToken.create({
        data: {
          userId: auth.user.id,
          tokenHash: TokenService.hashToken(rawToken),
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      await ctx
        .http()
        .post('/api/v1/auth/reset-password')
        .send({ token: 'bogus-token-value-1234', password: 'Another1x' })
        .expect(422);
      await ctx
        .http()
        .post('/api/v1/auth/reset-password')
        .send({ token: rawToken, password: 'ResetPassw0rd!' })
        .expect(200);
      // Token is single use and every session is revoked.
      await ctx
        .http()
        .post('/api/v1/auth/reset-password')
        .send({ token: rawToken, password: 'ResetPassw0rd!' })
        .expect(422);
      await ctx.http().get('/api/v1/auth/me').set(bearer(auth)).expect(401);
      await loginAs(ctx, email, 'ResetPassw0rd!');
    });
  });

  describe('verification', () => {
    it('verifies the email with a one-time code', async () => {
      const auth = await registerUser(ctx);
      await ctx
        .http()
        .post('/api/v1/auth/verification/request')
        .set(bearer(auth))
        .send({ channel: 'EMAIL' })
        .expect(200);
      const record = await ctx.prisma.verificationCode.findFirstOrThrow({
        where: { userId: auth.user.id, consumedAt: null },
      });
      // Brute-force protection: a wrong code counts as an attempt.
      await ctx
        .http()
        .post('/api/v1/auth/verification/confirm')
        .set(bearer(auth))
        .send({ channel: 'EMAIL', code: '000000' })
        .expect(422);
      // Replace the hash with a known code to confirm.
      const code = '123456';
      await ctx.prisma.verificationCode.update({
        where: { id: record.id },
        data: { codeHash: TokenService.hashToken(code) },
      });
      const res = await ctx
        .http()
        .post('/api/v1/auth/verification/confirm')
        .set(bearer(auth))
        .send({ channel: 'EMAIL', code: '۱۲۳۴۵۶' })
        .expect(200);
      expect(res.body.emailVerified).toBe(true);
      await ctx
        .http()
        .post('/api/v1/auth/verification/request')
        .set(bearer(auth))
        .send({ channel: 'EMAIL' })
        .expect(422);
    });
  });

  describe('authorization', () => {
    it('blocks customers from admin endpoints and allows admins', async () => {
      const customer = await registerUser(ctx);
      const denied = await ctx.http().get('/api/v1/admin/users').set(bearer(customer)).expect(403);
      expect(denied.body.error.code).toBe('PERMISSION_DENIED');

      const admin = await loginAsAdmin(ctx);
      const res = await ctx
        .http()
        .get('/api/v1/admin/users')
        .set(bearer(admin))
        .query({ limit: 5 })
        .expect(200);
      expect(res.body.pagination.limit).toBe(5);
      expect(res.body.items.length).toBeGreaterThan(0);
    });

    it('suspended users lose access immediately', async () => {
      const customer = await registerUser(ctx);
      const admin = await loginAsAdmin(ctx);
      await ctx
        .http()
        .patch(`/api/v1/admin/users/${customer.user.id}/status`)
        .set(bearer(admin))
        .send({ status: 'SUSPENDED' })
        .expect(200);
      const res = await ctx.http().get('/api/v1/auth/me').set(bearer(customer)).expect(403);
      expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
      const audit = await ctx.prisma.auditLog.findFirst({
        where: { action: 'user.status.update', entityId: customer.user.id },
      });
      expect(audit?.actorId).toBe(admin.user.id);
    });

    it('role assignment is audited and privilege escalation is controlled', async () => {
      const customer = await registerUser(ctx);
      const admin = await loginAsAdmin(ctx);
      const res = await ctx
        .http()
        .patch(`/api/v1/admin/users/${customer.user.id}/roles`)
        .set(bearer(admin))
        .send({ roles: ['CUSTOMER', 'SELLER'] })
        .expect(200);
      expect(res.body.roles.sort()).toEqual(['CUSTOMER', 'SELLER']);
      expect(res.body.permissions).toContain('seller.portal');

      // An ADMIN (without roles.manage) cannot grant SUPER_ADMIN.
      const adminEmail = uniqueEmail('admin');
      const plainAdmin = await registerUser(ctx, { email: adminEmail });
      await ctx
        .http()
        .patch(`/api/v1/admin/users/${plainAdmin.user.id}/roles`)
        .set(bearer(admin))
        .send({ roles: ['ADMIN'] })
        .expect(200);
      const adminSession = await loginAs(ctx, adminEmail, 'Passw0rd!123');
      const escalate = await ctx
        .http()
        .patch(`/api/v1/admin/users/${customer.user.id}/roles`)
        .set(bearer(adminSession))
        .send({ roles: ['SUPER_ADMIN'] })
        .expect(403);
      expect(escalate.body.error.code).toBe('PERMISSION_DENIED');
      // Nor modify the super admin.
      await ctx
        .http()
        .patch(`/api/v1/admin/users/${admin.user.id}/status`)
        .set(bearer(adminSession))
        .send({ status: 'SUSPENDED' })
        .expect(403);
      // Self-modification is refused.
      await ctx
        .http()
        .patch(`/api/v1/admin/users/${admin.user.id}/roles`)
        .set(bearer(admin))
        .send({ roles: ['CUSTOMER'] })
        .expect(403);
    });

    it('exposes roles and permissions to admins only', async () => {
      const admin = await loginAsAdmin(ctx);
      const roles = await ctx.http().get('/api/v1/admin/roles').set(bearer(admin)).expect(200);
      expect(roles.body.map((r: { name: string }) => r.name)).toContain('SUPER_ADMIN');
      const perms = await ctx
        .http()
        .get('/api/v1/admin/permissions')
        .set(bearer(admin))
        .expect(200);
      expect(perms.body.length).toBeGreaterThan(10);
      const customer = await registerUser(ctx);
      await ctx.http().get('/api/v1/admin/roles').set(bearer(customer)).expect(403);
    });
  });
});
