import {
  bearer,
  CSRF_HEADER,
  loginAs,
  loginAsAdmin,
  registerUser,
  uniqueEmail,
} from './utils/auth-helpers.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

const M = 1_000_000;

function cookieFrom(
  res: { headers: Record<string, string | string[] | undefined> },
  name: string,
): string | undefined {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const match = list.find((c) => c.startsWith(`${name}=`));
  return match?.split(';')[0];
}

describe('Cart & checkout (integration)', () => {
  let ctx: TestApp;
  let s25Black: string; // 12 in stock, 450M
  let s25Blue: string; // out of stock
  let charger: string; // 40 in stock, 18M
  let a55: string; // out of stock product

  beforeAll(async () => {
    ctx = await createTestApp();
    const s25 = await ctx.http().get('/api/v1/products/samsung-galaxy-s25').expect(200);
    s25Black = s25.body.variants.find((v: { sku: string }) => v.sku === 'SM-S25-128-BLK').id;
    s25Blue = s25.body.variants.find((v: { sku: string }) => v.sku === 'SM-S25-256-BLU').id;
    const anker = await ctx.http().get('/api/v1/products/anker-nano-65w').expect(200);
    charger = anker.body.variants[0].id;
    const galaxyA55 = await ctx.http().get('/api/v1/products/samsung-galaxy-a55').expect(200);
    a55 = galaxyA55.body.variants[0].id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('guest cart', () => {
    it('creates a cookie-backed cart and recalculates totals server-side', async () => {
      const empty = await ctx.http().get('/api/v1/cart').expect(200);
      expect(empty.body.items).toEqual([]);
      expect(empty.body.totals.total).toBe(0);

      const added = await ctx
        .http()
        .post('/api/v1/cart/items')
        .send({ variantId: s25Black, quantity: 2 })
        .expect(201);
      const cartCookie = cookieFrom(added, 'pe_cart');
      expect(cartCookie).toBeDefined();
      expect(added.body.items).toHaveLength(1);
      expect(added.body.totals.subtotal).toBe(900 * M);
      expect(added.body.items[0]).toMatchObject({
        quantity: 2,
        unitPrice: 450 * M,
        inStock: true,
        productSlug: 'samsung-galaxy-s25',
      });

      // Subsequent requests use the cookie.
      const again = await ctx
        .http()
        .post('/api/v1/cart/items')
        .set('Cookie', [cartCookie!])
        .send({ variantId: charger, quantity: 1 })
        .expect(201);
      expect(again.body.items).toHaveLength(2);
      expect(again.body.totals.subtotal).toBe(918 * M);
      expect(again.body.totals.itemCount).toBe(3);

      const fetched = await ctx.http().get('/api/v1/cart').set('Cookie', [cartCookie!]).expect(200);
      expect(fetched.body.id).toBe(added.body.id);

      // Quantity update, capped by stock (12) and line max (10)
      const itemId = fetched.body.items[0].id;
      const capped = await ctx
        .http()
        .patch(`/api/v1/cart/items/${itemId}`)
        .set('Cookie', [cartCookie!])
        .send({ quantity: 10 })
        .expect(200);
      expect(capped.body.items[0].quantity).toBe(10);
      await ctx
        .http()
        .patch(`/api/v1/cart/items/${itemId}`)
        .set('Cookie', [cartCookie!])
        .send({ quantity: 11 })
        .expect(400);

      const removed = await ctx
        .http()
        .delete(`/api/v1/cart/items/${itemId}`)
        .set('Cookie', [cartCookie!])
        .expect(200);
      expect(removed.body.items).toHaveLength(1);
      const cleared = await ctx
        .http()
        .delete('/api/v1/cart')
        .set('Cookie', [cartCookie!])
        .expect(200);
      expect(cleared.body.items).toEqual([]);
    });

    it('rejects out-of-stock, inactive and unknown variants', async () => {
      const oos = await ctx
        .http()
        .post('/api/v1/cart/items')
        .send({ variantId: s25Blue, quantity: 1 })
        .expect(422);
      expect(oos.body.error.code).toBe('OUT_OF_STOCK');
      await ctx.http().post('/api/v1/cart/items').send({ variantId: a55, quantity: 1 }).expect(422);
      await ctx
        .http()
        .post('/api/v1/cart/items')
        .send({ variantId: '01a0f2d3-0000-7000-8000-000000000000', quantity: 1 })
        .expect(404);
      await ctx
        .http()
        .post('/api/v1/cart/items')
        .send({ variantId: s25Black, quantity: 0 })
        .expect(400);
    });

    it('does not let one guest see another guest cart', async () => {
      const a = await ctx
        .http()
        .post('/api/v1/cart/items')
        .send({ variantId: charger, quantity: 1 })
        .expect(201);
      const b = await ctx
        .http()
        .post('/api/v1/cart/items')
        .send({ variantId: charger, quantity: 2 })
        .expect(201);
      expect(a.body.id).not.toBe(b.body.id);
      const itemOfA = a.body.items[0].id;
      await ctx
        .http()
        .delete(`/api/v1/cart/items/${itemOfA}`)
        .set('Cookie', [cookieFrom(b, 'pe_cart')!])
        .expect(404);
      const forged = await ctx
        .http()
        .get('/api/v1/cart')
        .set('Cookie', ['pe_cart=not-a-real-token-value-1234567890'])
        .expect(200);
      expect(forged.body.items).toEqual([]);
    });
  });

  describe('authenticated cart and merge', () => {
    it('merges the guest cart on login and on registration', async () => {
      const email = uniqueEmail('cart');
      const user = await registerUser(ctx, { email });
      // User already has 1 charger in their cart.
      await ctx
        .http()
        .post('/api/v1/cart/items')
        .set(bearer(user))
        .send({ variantId: charger, quantity: 1 })
        .expect(201);

      // Guest adds 2 chargers + 1 phone, then logs in with the cart cookie.
      const guest = await ctx
        .http()
        .post('/api/v1/cart/items')
        .send({ variantId: charger, quantity: 2 })
        .expect(201);
      const cartCookie = cookieFrom(guest, 'pe_cart')!;
      await ctx
        .http()
        .post('/api/v1/cart/items')
        .set('Cookie', [cartCookie])
        .send({ variantId: s25Black, quantity: 1 })
        .expect(201);

      await ctx
        .http()
        .post('/api/v1/auth/login')
        .set('Cookie', [cartCookie])
        .send({ identifier: email, password: 'Passw0rd!123' })
        .expect(200);
      const session = await loginAs(ctx, email, 'Passw0rd!123');
      const merged = await ctx.http().get('/api/v1/cart').set(bearer(session)).expect(200);
      const chargerLine = merged.body.items.find(
        (i: { variantId: string }) => i.variantId === charger,
      );
      expect(chargerLine.quantity).toBe(3);
      expect(merged.body.items).toHaveLength(2);

      // The guest cart is gone.
      const guestAfter = await ctx
        .http()
        .get('/api/v1/cart')
        .set('Cookie', [cartCookie])
        .expect(200);
      expect(guestAfter.body.items).toEqual([]);

      // Registration also merges.
      const guest2 = await ctx
        .http()
        .post('/api/v1/cart/items')
        .send({ variantId: charger, quantity: 1 })
        .expect(201);
      const reg = await ctx
        .http()
        .post('/api/v1/auth/register')
        .set('Cookie', [cookieFrom(guest2, 'pe_cart')!])
        .send({ email: uniqueEmail('cartreg'), password: 'Passw0rd!123' })
        .expect(201);
      const regCart = await ctx.http().get('/api/v1/auth/me').set(bearer(reg.body)).expect(200);
      expect(regCart.body.id).toBe(reg.body.user.id);
      const cart = await ctx.http().get('/api/v1/cart').set(bearer(reg.body)).expect(200);
      expect(cart.body.items[0].quantity).toBe(1);
    });

    it('requires CSRF header for cookie-authenticated cart mutations', async () => {
      const user = await registerUser(ctx);
      const res = await ctx
        .http()
        .post('/api/v1/cart/items')
        .set('Cookie', [`pe_access=${user.accessToken}`])
        .send({ variantId: charger, quantity: 1 })
        .expect(403);
      expect(res.body.error.code).toBe('CSRF_CHECK_FAILED');
      await ctx
        .http()
        .post('/api/v1/cart/items')
        .set('Cookie', [`pe_access=${user.accessToken}`])
        .set(CSRF_HEADER)
        .send({ variantId: charger, quantity: 1 })
        .expect(201);
    });

    it('flags price changes and stock shortages on read', async () => {
      const user = await registerUser(ctx);
      const admin = await loginAsAdmin(ctx);
      await ctx
        .http()
        .post('/api/v1/cart/items')
        .set(bearer(user))
        .send({ variantId: charger, quantity: 3 })
        .expect(201);
      // Price goes up.
      await ctx
        .http()
        .patch(`/api/v1/admin/variants/${charger}`)
        .set(bearer(admin))
        .send({ price: 19 * M })
        .expect(200);
      const cart = await ctx.http().get('/api/v1/cart').set(bearer(user)).expect(200);
      expect(cart.body.items[0]).toMatchObject({
        priceChanged: true,
        unitPrice: 19 * M,
        priceAtAdd: 18 * M,
      });
      expect(cart.body.totals.subtotal).toBe(57 * M);
      expect(cart.body.warnings.map((w: { code: string }) => w.code)).toContain('PRICE_CHANGED');
      await ctx
        .http()
        .patch(`/api/v1/admin/variants/${charger}`)
        .set(bearer(admin))
        .send({ price: 18 * M })
        .expect(200);

      // Stock drops below the cart quantity.
      const inv = await ctx
        .http()
        .get(`/api/v1/admin/inventory/${charger}`)
        .set(bearer(admin))
        .expect(200);
      await ctx
        .http()
        .patch(`/api/v1/admin/inventory/${charger}/adjust`)
        .set(bearer(admin))
        .send({ quantity: -(inv.body.stockQuantity - 2) })
        .expect(200);
      const short = await ctx.http().get('/api/v1/cart').set(bearer(user)).expect(200);
      expect(short.body.items[0].quantityExceedsStock).toBe(true);
      expect(short.body.warnings.map((w: { code: string }) => w.code)).toContain(
        'QUANTITY_REDUCED',
      );
      // Unsellable lines are excluded from totals until fixed.
      expect(short.body.totals.subtotal).toBe(0);
      await ctx
        .http()
        .patch(`/api/v1/admin/inventory/${charger}/adjust`)
        .set(bearer(admin))
        .send({ quantity: inv.body.stockQuantity - 2 })
        .expect(200);
    });
  });

  describe('coupons', () => {
    let couponCode: string;
    let couponId: string;

    beforeAll(async () => {
      const admin = await loginAsAdmin(ctx);
      couponCode = `TEST${Date.now().toString(36).toUpperCase()}`;
      const created = await ctx
        .http()
        .post('/api/v1/admin/coupons')
        .set(bearer(admin))
        .send({
          code: couponCode.toLowerCase(),
          type: 'PERCENTAGE',
          value: 10,
          maxDiscountAmount: 30 * M,
          minCartAmount: 100 * M,
        })
        .expect(201);
      couponId = created.body.id;
      expect(created.body.code).toBe(couponCode);
    });

    it('applies, caps and removes coupons', async () => {
      const user = await registerUser(ctx);
      await ctx
        .http()
        .post('/api/v1/cart/items')
        .set(bearer(user))
        .send({ variantId: charger, quantity: 1 })
        .expect(201);
      const tooSmall = await ctx
        .http()
        .post('/api/v1/cart/coupon')
        .set(bearer(user))
        .send({ code: couponCode })
        .expect(422);
      expect(tooSmall.body.error.code).toBe('COUPON_MIN_CART');

      await ctx
        .http()
        .post('/api/v1/cart/items')
        .set(bearer(user))
        .send({ variantId: s25Black, quantity: 1 })
        .expect(201);
      const applied = await ctx
        .http()
        .post('/api/v1/cart/coupon')
        .set(bearer(user))
        .send({ code: couponCode.toLowerCase() })
        .expect(201);
      expect(applied.body.coupon.code).toBe(couponCode);
      // 10% of 468M = 46.8M, capped at 30M
      expect(applied.body.totals.discount).toBe(30 * M);
      expect(applied.body.totals.total).toBe(438 * M);

      const bad = await ctx
        .http()
        .post('/api/v1/cart/coupon')
        .set(bearer(user))
        .send({ code: 'NOPE-NOPE' })
        .expect(422);
      expect(bad.body.error.code).toBe('COUPON_NOT_FOUND');

      const removed = await ctx.http().delete('/api/v1/cart/coupon').set(bearer(user)).expect(200);
      expect(removed.body.coupon).toBeNull();
      expect(removed.body.totals.discount).toBe(0);
    });

    it('invalidates expired or disabled coupons already in a cart', async () => {
      const user = await registerUser(ctx);
      const admin = await loginAsAdmin(ctx);
      await ctx
        .http()
        .post('/api/v1/cart/items')
        .set(bearer(user))
        .send({ variantId: s25Black, quantity: 1 })
        .expect(201);
      await ctx
        .http()
        .post('/api/v1/cart/coupon')
        .set(bearer(user))
        .send({ code: couponCode })
        .expect(201);
      await ctx
        .http()
        .patch(`/api/v1/admin/coupons/${couponId}`)
        .set(bearer(admin))
        .send({ isActive: false })
        .expect(200);
      const cart = await ctx.http().get('/api/v1/cart').set(bearer(user)).expect(200);
      expect(cart.body.coupon).toBeNull();
      expect(cart.body.warnings.map((w: { code: string }) => w.code)).toContain('COUPON_INVALID');
      await ctx
        .http()
        .patch(`/api/v1/admin/coupons/${couponId}`)
        .set(bearer(admin))
        .send({ isActive: true })
        .expect(200);
      // customers cannot manage coupons
      await ctx.http().get('/api/v1/admin/coupons').set(bearer(user)).expect(403);
    });
  });

  describe('checkout quote', () => {
    it('returns shipping options priced for the cart and an authoritative quote', async () => {
      const user = await registerUser(ctx);
      const address = await ctx
        .http()
        .post('/api/v1/users/me/addresses')
        .set(bearer(user))
        .send({
          title: 'خانه',
          recipientName: 'علی رضایی',
          recipientPhone: '09123456789',
          province: 'تهران',
          city: 'تهران',
          addressLine: 'خیابان ولیعصر، پلاک ۱',
          postalCode: '1234567890',
        })
        .expect(201);

      // Small cart: fees apply
      await ctx
        .http()
        .post('/api/v1/cart/items')
        .set(bearer(user))
        .send({ variantId: charger, quantity: 1 })
        .expect(201);
      const methods = await ctx
        .http()
        .get('/api/v1/checkout/shipping-methods')
        .set(bearer(user))
        .expect(200);
      const standard = methods.body.find((m: { code: string }) => m.code === 'post-standard');
      expect(standard.fee).toBe(350_000);

      const quote = await ctx
        .http()
        .post('/api/v1/checkout/validate')
        .set(bearer(user))
        .send({ addressId: address.body.id, shippingMethodCode: 'post-standard' })
        .expect(200);
      expect(quote.body.totals).toMatchObject({
        subtotal: 18 * M,
        discount: 0,
        shippingFee: 350_000,
        grandTotal: 18 * M + 350_000,
      });
      expect(quote.body.canPlaceOrder).toBe(true);
      expect(quote.body.address.postalCode).toBe('1234567890');

      // Big cart: free shipping threshold reached
      await ctx
        .http()
        .post('/api/v1/cart/items')
        .set(bearer(user))
        .send({ variantId: s25Black, quantity: 1 })
        .expect(201);
      const free = await ctx
        .http()
        .post('/api/v1/checkout/validate')
        .set(bearer(user))
        .send({ addressId: address.body.id, shippingMethodCode: 'post-standard' })
        .expect(200);
      expect(free.body.totals.shippingFee).toBe(0);
      expect(free.body.totals.grandTotal).toBe(468 * M);

      // Someone else's address is rejected; unknown shipping method rejected
      const other = await registerUser(ctx);
      await ctx
        .http()
        .post('/api/v1/cart/items')
        .set(bearer(other))
        .send({ variantId: charger, quantity: 1 })
        .expect(201);
      await ctx
        .http()
        .post('/api/v1/checkout/validate')
        .set(bearer(other))
        .send({ addressId: address.body.id, shippingMethodCode: 'post-standard' })
        .expect(404);
      await ctx
        .http()
        .post('/api/v1/checkout/validate')
        .set(bearer(user))
        .send({ addressId: address.body.id, shippingMethodCode: 'teleport' })
        .expect(404);
      // Guests cannot check out
      await ctx
        .http()
        .post('/api/v1/checkout/validate')
        .send({ addressId: address.body.id, shippingMethodCode: 'post-standard' })
        .expect(401);
    });

    it('blocks the order when an item became unavailable', async () => {
      const user = await registerUser(ctx);
      const admin = await loginAsAdmin(ctx);
      const address = await ctx
        .http()
        .post('/api/v1/users/me/addresses')
        .set(bearer(user))
        .send({
          title: 'خانه',
          recipientName: 'علی رضایی',
          recipientPhone: '09123456789',
          province: 'تهران',
          city: 'تهران',
          addressLine: 'خیابان ولیعصر، پلاک ۱',
          postalCode: '1234567890',
        })
        .expect(201);
      await ctx
        .http()
        .post('/api/v1/cart/items')
        .set(bearer(user))
        .send({ variantId: charger, quantity: 2 })
        .expect(201);
      const inv = await ctx
        .http()
        .get(`/api/v1/admin/inventory/${charger}`)
        .set(bearer(admin))
        .expect(200);
      await ctx
        .http()
        .patch(`/api/v1/admin/inventory/${charger}/adjust`)
        .set(bearer(admin))
        .send({ quantity: -inv.body.stockQuantity })
        .expect(200);
      const quote = await ctx
        .http()
        .post('/api/v1/checkout/validate')
        .set(bearer(user))
        .send({ addressId: address.body.id, shippingMethodCode: 'post-express' })
        .expect(200);
      expect(quote.body.canPlaceOrder).toBe(false);
      expect(quote.body.issues[0].code).toBe('OUT_OF_STOCK');
      await ctx
        .http()
        .patch(`/api/v1/admin/inventory/${charger}/adjust`)
        .set(bearer(admin))
        .send({ quantity: inv.body.stockQuantity })
        .expect(200);
      const empty = await registerUser(ctx);
      const res = await ctx
        .http()
        .post('/api/v1/checkout/validate')
        .set(bearer(empty))
        .send({ addressId: address.body.id, shippingMethodCode: 'post-express' })
        .expect(422);
      expect(res.body.error.code).toBe('CART_EMPTY');
    });
  });
});
