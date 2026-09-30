import { createTestApp, type TestApp } from './utils/test-app.js';

describe('Health (integration)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('GET /health returns ok', async () => {
    const res = await ctx.http().get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('GET /health/ready checks the database', async () => {
    const res = await ctx.http().get('/health/ready').expect(200);
    expect(res.body.checks.database.status).toBe('up');
  });

  it('returns the standard error envelope for unknown routes', async () => {
    const res = await ctx.http().get('/api/v1/does-not-exist').expect(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });

  it('sets security headers and hides x-powered-by', async () => {
    const res = await ctx.http().get('/health').expect(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('seeded the RBAC roles', async () => {
    const roles = await ctx.prisma.role.findMany({ select: { name: true } });
    expect(roles.map((r) => r.name).sort()).toEqual(['ADMIN', 'CUSTOMER', 'SELLER', 'SUPER_ADMIN']);
  });
});
