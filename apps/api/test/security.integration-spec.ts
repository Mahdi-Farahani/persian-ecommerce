import { bearer, registerUser } from './utils/auth-helpers.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

/**
 * Security regression checks that do not fit a feature suite: transport
 * headers, CSRF rules for cookie sessions, strict input validation, and
 * defensive handling of hostile search input.
 */
describe('Security hardening (integration)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('sends hardened response headers and never leaks server internals', async () => {
    const res = await ctx.http().get('/api/v1/products?limit=1').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['referrer-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['cache-control']).toContain('public');
    const missing = await ctx.http().get('/api/v1/products/does-not-exist').expect(404);
    expect(JSON.stringify(missing.body)).not.toMatch(/prisma|stack|node_modules/i);
  });

  it('requires the CSRF header for cookie-authenticated mutations but not for bearer tokens', async () => {
    const email = `csrf-${Date.now()}@test.local`;
    const password = 'Passw0rd!123';
    await registerUser(ctx, { email, password });
    const login = await ctx
      .http()
      .post('/api/v1/auth/login')
      .send({ identifier: email, password })
      .expect(200);
    const setCookie = login.headers['set-cookie'] as unknown as string[] | string | undefined;
    const rawCookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    const cookies = rawCookies.map((c) => c.split(';')[0]!);
    expect(cookies.some((c) => c.startsWith('pe_access='))).toBe(true);
    expect(rawCookies.join(';')).toMatch(/HttpOnly/i);

    // Cookie session, no CSRF header, no allowed origin → refused.
    const refused = await ctx
      .http()
      .patch('/api/v1/users/me')
      .set('Cookie', cookies)
      .send({ firstName: 'مهاجم' })
      .expect(403);
    expect(refused.body.error.code).toMatch(/CSRF/i);
    // Same request with the custom header → accepted.
    await ctx
      .http()
      .patch('/api/v1/users/me')
      .set('Cookie', cookies)
      .set('X-Requested-With', 'fetch')
      .send({ firstName: 'علی' })
      .expect(200);
    // Reads with the cookie work without the header.
    await ctx.http().get('/api/v1/users/me').set('Cookie', cookies).expect(200);
    // Bearer tokens are not CSRF-prone and need no header.
    await ctx
      .http()
      .patch('/api/v1/users/me')
      .set(bearer(login.body))
      .send({ firstName: 'علی' })
      .expect(200);
  });

  it('rejects unknown fields and out-of-range values everywhere', async () => {
    const user = bearer(await registerUser(ctx));
    const unknown = await ctx
      .http()
      .post('/api/v1/cart/items')
      .set(user)
      .send({ variantId: '01a0f307-0000-7000-8000-000000000000', quantity: 1, price: 1 })
      .expect(400);
    expect(JSON.stringify(unknown.body)).toContain('price');
    await ctx.http().get('/api/v1/products?limit=10000').expect(400);
    await ctx.http().get('/api/v1/products?page=-1').expect(400);
    await ctx
      .http()
      .post('/api/v1/users/me/addresses')
      .set(user)
      .send({
        title: 'x'.repeat(500),
        recipientName: 'a',
        recipientPhone: 'b',
        province: 'c',
        city: 'd',
        addressLine: 'e',
        postalCode: 'f',
      })
      .expect(400);
  });

  it('treats hostile search input as plain text', async () => {
    for (const q of ["' OR 1=1 --", '<script>alert(1)</script>', '+-><()~*"@', '%'.repeat(50)]) {
      const res = await ctx.http().get('/api/v1/search').query({ q }).expect(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      const suggest = await ctx.http().get('/api/v1/search/suggest').query({ q }).expect(200);
      expect(JSON.stringify(suggest.body)).not.toContain('<script>');
    }
  });

  it('does not reveal whether an account exists on login or password reset', async () => {
    const unknown = await ctx
      .http()
      .post('/api/v1/auth/login')
      .send({ identifier: 'nobody-here@test.local', password: 'Wrong-Passw0rd!' })
      .expect(401);
    const registered = await registerUser(ctx);
    const wrong = await ctx
      .http()
      .post('/api/v1/auth/login')
      .send({ identifier: registered.user.email, password: 'Wrong-Passw0rd!' })
      .expect(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
    await ctx
      .http()
      .post('/api/v1/auth/forgot-password')
      .send({ identifier: 'nobody-here@test.local' })
      .expect(200);
  });
});
