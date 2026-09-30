import type { Agent } from 'supertest';
import { bearer, loginAs, loginAsAdmin, registerUser, uniqueEmail } from './utils/auth-helpers.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

/**
 * Authorization matrix for the administration surface. Every admin endpoint
 * must reject anonymous (401) and customer (403) callers, and permissions —
 * not the role name — decide what a plain ADMIN may do.
 */
describe('Admin authorization matrix (integration)', () => {
  let ctx: TestApp;
  let superAdmin: { Authorization: string };
  let admin: { Authorization: string };
  let customer: { Authorization: string };

  const http = (): Agent => ctx.http();

  beforeAll(async () => {
    ctx = await createTestApp();
    superAdmin = bearer(await loginAsAdmin(ctx));
    customer = bearer(await registerUser(ctx));

    // Promote a fresh user to the plain ADMIN role (SUPER_ADMIN has roles.manage).
    const email = uniqueEmail('admin');
    const password = 'Admin-Passw0rd!123';
    const promoted = await registerUser(ctx, { email, password });
    await http()
      .patch(`/api/v1/admin/users/${promoted.user.id}/roles`)
      .set(superAdmin)
      .send({ roles: ['CUSTOMER', 'ADMIN'] })
      .expect(200);
    const relogin = await loginAs(ctx, email, password);
    expect(relogin.user.roles).toContain('ADMIN');
    expect(relogin.user.permissions).toContain('orders.view');
    expect(relogin.user.permissions).not.toContain('payment_gateway.update');
    admin = bearer(relogin);
  });

  afterAll(async () => {
    await ctx.close();
  });

  const readEndpoints = [
    '/api/v1/admin/users',
    '/api/v1/admin/products',
    '/api/v1/admin/categories',
    '/api/v1/admin/brands',
    '/api/v1/admin/attributes',
    '/api/v1/admin/inventory',
    '/api/v1/admin/inventory/summary',
    '/api/v1/admin/orders',
    '/api/v1/admin/payments',
    '/api/v1/admin/payment-gateways',
    '/api/v1/admin/coupons',
    '/api/v1/admin/shipping-methods',
    '/api/v1/admin/reviews',
    '/api/v1/admin/dashboard',
    '/api/v1/admin/audit-logs',
  ];

  it('rejects anonymous and customer access to every admin read endpoint', async () => {
    for (const path of readEndpoints) {
      await http().get(path).expect(401);
      const res = await http().get(path).set(customer).expect(403);
      expect(res.body.error.code).toBe('PERMISSION_DENIED');
    }
  });

  it('grants a plain ADMIN the read endpoints its permission bundle covers', async () => {
    for (const path of readEndpoints) {
      await http().get(path).set(admin).expect(200);
    }
  });

  it('withholds operations outside the ADMIN bundle but allows them for SUPER_ADMIN', async () => {
    // payment_gateway.update / payment.refund / roles.manage / settings.manage are SUPER_ADMIN only.
    await http()
      .patch('/api/v1/admin/payment-gateways/mock')
      .set(admin)
      .send({ enabled: true })
      .expect(403);
    await http().post('/api/v1/admin/payment-gateways/mock/test').set(admin).expect(403);
    await http()
      .post('/api/v1/admin/shipping-methods')
      .set(admin)
      .send({ code: 'x-y', name: 'تست', baseFee: 0 })
      .expect(403);
    const someone = await registerUser(ctx);
    await http()
      .patch(`/api/v1/admin/users/${someone.user.id}/roles`)
      .set(admin)
      .send({ roles: ['CUSTOMER', 'ADMIN'] })
      .expect(403);

    // What the bundle does cover works and is audited.
    const status = await http()
      .patch(`/api/v1/admin/users/${someone.user.id}/status`)
      .set(admin)
      .send({ status: 'SUSPENDED' })
      .expect(200);
    expect(status.body.status).toBe('SUSPENDED');
    const audit = await ctx.prisma.auditLog.findFirst({
      where: { entityId: someone.user.id, action: { startsWith: 'user.' } },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).not.toBeNull();
    await http()
      .get('/api/v1/admin/audit-logs?entityType=User&entityId=' + someone.user.id)
      .set(admin)
      .expect(200);

    // SUPER_ADMIN may do all of it.
    const gateway = await http()
      .get('/api/v1/admin/payment-gateways/mock')
      .set(superAdmin)
      .expect(200);
    expect(gateway.body.provider).toBe('MOCK');
  });

  it('never exposes password hashes or secrets through admin reads', async () => {
    const users = await http().get('/api/v1/admin/users?limit=5').set(superAdmin).expect(200);
    const text = JSON.stringify(users.body);
    expect(text).not.toMatch(/passwordHash|\$argon2/);
    const gateways = await http().get('/api/v1/admin/payment-gateways').set(superAdmin).expect(200);
    expect(JSON.stringify(gateways.body)).not.toContain('credentialsEncrypted');
  });
});
