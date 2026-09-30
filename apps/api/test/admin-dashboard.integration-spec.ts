import type { DashboardMetrics } from '@pe/shared';
import { bearer, loginAsAdmin, registerUser } from './utils/auth-helpers.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

describe('Admin dashboard & audit logs (integration)', () => {
  let ctx: TestApp;
  let admin: { Authorization: string };

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = bearer(await loginAsAdmin(ctx));
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('returns consistent dashboard metrics', async () => {
    const res = await ctx.http().get('/api/v1/admin/dashboard').set(admin).expect(200);
    const m = res.body as DashboardMetrics;
    expect(m.sales.allTime.orders).toBeGreaterThanOrEqual(m.sales.last30Days.orders);
    expect(m.sales.last30Days.orders).toBeGreaterThanOrEqual(m.sales.last7Days.orders);
    expect(m.sales.last7Days.orders).toBeGreaterThanOrEqual(m.sales.today.orders);
    expect(m.sales.allTime.revenue).toBeGreaterThanOrEqual(0);
    if (m.sales.allTime.orders > 0) {
      expect(m.sales.allTime.averageOrderValue).toBe(
        Math.round(m.sales.allTime.revenue / m.sales.allTime.orders),
      );
    }
    expect(m.dailySales).toHaveLength(14);
    expect(m.dailySales.at(-1)!.date).toBe(new Date().toISOString().slice(0, 10));
    expect(m.dailySales.reduce((s, p) => s + p.orders, 0)).toBeLessThanOrEqual(
      m.sales.allTime.orders,
    );
    expect(m.customers.total).toBeGreaterThan(0);
    expect(m.catalog.activeProducts).toBeGreaterThan(0);
    expect(m.inventory.trackedVariants).toBeGreaterThan(0);
    expect(Array.isArray(m.recentOrders)).toBe(true);
    expect(m.recentOrders.length).toBeLessThanOrEqual(5);
    expect(m.recentActivity.length).toBeLessThanOrEqual(10);
    if (m.recentActivity.length > 0) {
      expect(m.recentActivity[0]).toMatchObject({
        action: expect.any(String),
        createdAt: expect.any(String),
      });
    }
  });

  it('lists audit logs with filters and redacts secrets', async () => {
    // Produce an audited action with a secret-looking key in metadata.
    await ctx
      .http()
      .patch('/api/v1/admin/payment-gateways/zarinpal')
      .set(admin)
      .send({ credentials: { merchantId: '22222222-3333-4333-8444-555555555555' } })
      .expect(200);
    const list = await ctx
      .http()
      .get('/api/v1/admin/audit-logs?action=payment_gateway&limit=5')
      .set(admin)
      .expect(200);
    expect(list.body.items.length).toBeGreaterThan(0);
    const entry = list.body.items[0];
    expect(entry.action.startsWith('payment_gateway.')).toBe(true);
    expect(entry.actor).toMatchObject({ email: expect.any(String) });
    expect(JSON.stringify(entry.metadata)).not.toContain('22222222-3333');

    const byEntity = await ctx
      .http()
      .get('/api/v1/admin/audit-logs?entityType=PaymentProviderConfig&entityId=ZARINPAL')
      .set(admin)
      .expect(200);
    expect(byEntity.body.items.every((e: { entityId: string }) => e.entityId === 'ZARINPAL')).toBe(
      true,
    );

    const actions = await ctx.http().get('/api/v1/admin/audit-logs/actions').set(admin).expect(200);
    expect(actions.body).toContain('payment_gateway.update');

    await ctx.http().get('/api/v1/admin/audit-logs?action=bad action').set(admin).expect(400);
    await ctx.http().get('/api/v1/admin/audit-logs?from=not-a-date').set(admin).expect(400);
  });

  it('enforces permissions on dashboard and audit endpoints', async () => {
    const customer = bearer(await registerUser(ctx));
    await ctx.http().get('/api/v1/admin/dashboard').set(customer).expect(403);
    await ctx.http().get('/api/v1/admin/audit-logs').set(customer).expect(403);
    await ctx.http().get('/api/v1/admin/dashboard').expect(401);
  });
});
