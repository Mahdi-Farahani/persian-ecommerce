import { bearer, registerUser } from './utils/auth-helpers.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

const validAddress = {
  title: 'خانه',
  recipientName: 'علی رضایی',
  recipientPhone: '۰۹۱۲۳۴۵۶۷۸۹',
  province: 'تهران',
  city: 'تهران',
  addressLine: 'خیابان ولیعصر، کوچه ۱۲، پلاک ۳',
  postalCode: '۱۲۳۴۵۶۷۸۹۰',
};

describe('Users & addresses (integration)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('updates the profile', async () => {
    const auth = await registerUser(ctx);
    const res = await ctx
      .http()
      .patch('/api/v1/users/me')
      .set(bearer(auth))
      .send({ firstName: 'مریم', lastName: 'کریمی' })
      .expect(200);
    expect(res.body).toMatchObject({ firstName: 'مریم', lastName: 'کریمی' });
    await ctx
      .http()
      .patch('/api/v1/users/me')
      .set(bearer(auth))
      .send({ email: 'x@y.z' })
      .expect(400);
  });

  it('manages addresses with default handling and ownership', async () => {
    const auth = await registerUser(ctx);
    const other = await registerUser(ctx);

    const first = await ctx
      .http()
      .post('/api/v1/users/me/addresses')
      .set(bearer(auth))
      .send(validAddress)
      .expect(201);
    expect(first.body).toMatchObject({
      isDefault: true,
      recipientPhone: '09123456789',
      postalCode: '1234567890',
    });

    const second = await ctx
      .http()
      .post('/api/v1/users/me/addresses')
      .set(bearer(auth))
      .send({ ...validAddress, title: 'محل کار', isDefault: true })
      .expect(201);
    expect(second.body.isDefault).toBe(true);

    const list = await ctx.http().get('/api/v1/users/me/addresses').set(bearer(auth)).expect(200);
    expect(list.body).toHaveLength(2);
    expect(list.body.filter((a: { isDefault: boolean }) => a.isDefault)).toHaveLength(1);
    expect(list.body[0].id).toBe(second.body.id);

    // Other users cannot read, edit or delete it.
    await ctx
      .http()
      .get(`/api/v1/users/me/addresses/${first.body.id}`)
      .set(bearer(other))
      .expect(404);
    await ctx
      .http()
      .patch(`/api/v1/users/me/addresses/${first.body.id}`)
      .set(bearer(other))
      .send({ title: 'x' })
      .expect(404);
    await ctx
      .http()
      .delete(`/api/v1/users/me/addresses/${first.body.id}`)
      .set(bearer(other))
      .expect(404);

    // Deleting the default promotes another address.
    await ctx
      .http()
      .delete(`/api/v1/users/me/addresses/${second.body.id}`)
      .set(bearer(auth))
      .expect(204);
    const after = await ctx.http().get('/api/v1/users/me/addresses').set(bearer(auth)).expect(200);
    expect(after.body).toHaveLength(1);
    expect(after.body[0].isDefault).toBe(true);
  });

  it('validates address fields', async () => {
    const auth = await registerUser(ctx);
    const res = await ctx
      .http()
      .post('/api/v1/users/me/addresses')
      .set(bearer(auth))
      .send({ ...validAddress, province: 'ناکجا', postalCode: '123', recipientPhone: '123' })
      .expect(400);
    expect(res.body.error.details.join(' ')).toMatch(/استان/);
    expect(res.body.error.details.join(' ')).toMatch(/کد پستی/);
  });
});
