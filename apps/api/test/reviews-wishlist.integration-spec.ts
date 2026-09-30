import type { Agent } from 'supertest';
import { OrdersService } from '../src/orders/orders.service.js';
import { bearer, loginAsAdmin, registerUser } from './utils/auth-helpers.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

const validAddress = {
  title: 'خانه',
  recipientName: 'علی رضایی',
  recipientPhone: '09123456789',
  province: 'تهران',
  city: 'تهران',
  addressLine: 'خیابان ولیعصر، کوچه ۱۲، پلاک ۳',
  postalCode: '1234567890',
};

const review = { rating: 5, title: 'عالی بود', body: 'کیفیت ساخت و سرعت شارژ فوق‌العاده است.' };

describe('Reviews & wishlist (integration)', () => {
  let ctx: TestApp;
  let admin: { Authorization: string };
  let productId: string; // anker-nano-65w
  let variantId: string;
  let otherProductId: string; // samsung-galaxy-s25

  const http = (): Agent => ctx.http();

  async function customer(): Promise<{ auth: { Authorization: string }; id: string }> {
    const registered = await registerUser(ctx);
    return { auth: bearer(registered), id: registered.user.id };
  }

  /** Places and pays (mock gateway) an order for the charger so the buyer counts as verified. */
  async function purchase(auth: { Authorization: string }): Promise<string> {
    const address = await http()
      .post('/api/v1/users/me/addresses')
      .set(auth)
      .send(validAddress)
      .expect(201);
    await http().post('/api/v1/cart/items').set(auth).send({ variantId, quantity: 1 }).expect(201);
    const order = await http()
      .post('/api/v1/checkout')
      .set(auth)
      .send({ addressId: address.body.id, shippingMethodCode: 'post-standard' })
      .expect(201);
    const payment = await http()
      .post('/api/v1/payments')
      .set(auth)
      .send({ orderId: order.body.id })
      .expect(201);
    await http()
      .get(
        `/api/v1/payments/mock/callback?authority=${payment.body.payment.providerAuthority}&status=OK`,
      )
      .expect(303);
    return order.body.id as string;
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = bearer(await loginAsAdmin(ctx));
    await http()
      .patch('/api/v1/admin/payment-gateways/mock')
      .set(admin)
      .send({ enabled: true, isDefault: true, environment: 'SANDBOX' })
      .expect(200);
    const anker = await http().get('/api/v1/products/anker-nano-65w').expect(200);
    productId = anker.body.id;
    variantId = anker.body.variants[0].id;
    const s25 = await http().get('/api/v1/products/samsung-galaxy-s25').expect(200);
    otherProductId = s25.body.id;
  });

  afterAll(async () => {
    await ctx.app.get(OrdersService).expireUnpaid(new Date(Date.now() + 365 * 24 * 3_600_000));
    await ctx.close();
  });

  describe('reviews', () => {
    it('requires authentication to submit and reports eligibility', async () => {
      await http().post(`/api/v1/products/${productId}/reviews`).send(review).expect(401);
      const anonymous = await http()
        .get(`/api/v1/products/${productId}/reviews/summary`)
        .expect(200);
      expect(anonymous.body.eligibility).toMatchObject({
        canReview: false,
        reason: 'NOT_AUTHENTICATED',
      });
      expect(anonymous.body.summary.distribution).toHaveLength(5);
      await http().get('/api/v1/products/01a0f307-0000-7000-8000-000000000000/reviews').expect(404);
    });

    it('accepts one review per customer, moderates it and updates the product rating', async () => {
      const buyer = await customer();
      await purchase(buyer.auth);
      const before = await http().get('/api/v1/products/anker-nano-65w').expect(200);

      const created = await http()
        .post(`/api/v1/products/${productId}/reviews`)
        .set(buyer.auth)
        .send(review)
        .expect(201);
      expect(created.body).toMatchObject({
        status: 'PENDING',
        isVerifiedPurchase: true,
        isMine: true,
        rating: 5,
        author: { name: expect.stringContaining('کاربر') },
      });
      expect(created.body.author.name).not.toContain('@');

      // Duplicate is refused; a pending review is not public yet.
      const dup = await http()
        .post(`/api/v1/products/${productId}/reviews`)
        .set(buyer.auth)
        .send(review)
        .expect(409);
      expect(dup.body.error.code).toBe('REVIEW_ALREADY_EXISTS');
      const publicList = await http().get(`/api/v1/products/${productId}/reviews`).expect(200);
      expect(publicList.body.items.some((r: { id: string }) => r.id === created.body.id)).toBe(
        false,
      );
      const page = await http()
        .get(`/api/v1/products/${productId}/reviews/summary`)
        .set(buyer.auth)
        .expect(200);
      expect(page.body.eligibility).toMatchObject({
        canReview: false,
        reason: 'ALREADY_REVIEWED',
        hasPurchased: true,
      });
      expect(page.body.mine.id).toBe(created.body.id);

      // Validation
      await http()
        .post(`/api/v1/products/${otherProductId}/reviews`)
        .set(buyer.auth)
        .send({ rating: 6, title: 'x', body: 'short' })
        .expect(400);

      // Moderation: approve → visible and rating updated.
      const queue = await http().get('/api/v1/admin/reviews?status=PENDING').set(admin).expect(200);
      expect(queue.body.items.some((r: { id: string }) => r.id === created.body.id)).toBe(true);
      const approved = await http()
        .patch(`/api/v1/admin/reviews/${created.body.id}/status`)
        .set(admin)
        .send({ status: 'APPROVED' })
        .expect(200);
      expect(approved.body.status).toBe('APPROVED');
      expect(approved.body.customer.email).toBeDefined();
      const visible = await http()
        .get(`/api/v1/products/${productId}/reviews?sort=highest`)
        .expect(200);
      expect(visible.body.items.some((r: { id: string }) => r.id === created.body.id)).toBe(true);
      const after = await http().get('/api/v1/products/anker-nano-65w').expect(200);
      expect(after.body.ratingCount).toBe(before.body.ratingCount + 1);
      expect(after.body.ratingAverage).toBeGreaterThan(0);
      const summary = await http().get(`/api/v1/products/${productId}/reviews/summary`).expect(200);
      expect(summary.body.summary.ratingCount).toBe(after.body.ratingCount);
      expect(summary.body.summary.distribution[4]).toBeGreaterThanOrEqual(1);

      // Same status again is rejected; the moderation is audited.
      await http()
        .patch(`/api/v1/admin/reviews/${created.body.id}/status`)
        .set(admin)
        .send({ status: 'APPROVED' })
        .expect(422);
      const audit = await ctx.prisma.auditLog.findFirst({
        where: { action: 'review.moderate', entityId: created.body.id },
      });
      expect(audit).not.toBeNull();

      // Editing sends it back to moderation and removes it from the rating.
      const edited = await http()
        .patch(`/api/v1/reviews/${created.body.id}`)
        .set(buyer.auth)
        .send({ rating: 4, body: 'بعد از یک ماه استفاده هنوز راضی هستم.' })
        .expect(200);
      expect(edited.body).toMatchObject({ status: 'PENDING', rating: 4 });
      const afterEdit = await http().get('/api/v1/products/anker-nano-65w').expect(200);
      expect(afterEdit.body.ratingCount).toBe(before.body.ratingCount);

      // Rejection with a note visible to the author only.
      const rejected = await http()
        .patch(`/api/v1/admin/reviews/${created.body.id}/status`)
        .set(admin)
        .send({ status: 'REJECTED', note: 'متن حاوی اطلاعات تماس است' })
        .expect(200);
      expect(rejected.body.moderationNote).toBe('متن حاوی اطلاعات تماس است');
      const mine = await http().get('/api/v1/reviews/me').set(buyer.auth).expect(200);
      expect(mine.body.items[0]).toMatchObject({
        status: 'REJECTED',
        moderationNote: 'متن حاوی اطلاعات تماس است',
        product: { slug: 'anker-nano-65w' },
      });

      // Other customers cannot touch it; the owner can delete it.
      const stranger = await customer();
      await http()
        .patch(`/api/v1/reviews/${created.body.id}`)
        .set(stranger.auth)
        .send({ rating: 1 })
        .expect(404);
      await http().delete(`/api/v1/reviews/${created.body.id}`).set(stranger.auth).expect(404);
      await http().get('/api/v1/admin/reviews').set(stranger.auth).expect(403);
      await http().delete(`/api/v1/reviews/${created.body.id}`).set(buyer.auth).expect(204);
      await http().delete(`/api/v1/reviews/${created.body.id}`).set(buyer.auth).expect(404);
    });

    it('marks reviews from non-buyers as unverified and hides pending ones from the public', async () => {
      const visitor = await customer();
      const created = await http()
        .post(`/api/v1/products/${otherProductId}/reviews`)
        .set(visitor.auth)
        .send({ rating: 3, title: 'متوسط', body: 'دوربین خوب است ولی باتری ضعیف است.' })
        .expect(201);
      expect(created.body.isVerifiedPurchase).toBe(false);
      const summary = await http()
        .get(`/api/v1/products/${otherProductId}/reviews/summary`)
        .set(visitor.auth)
        .expect(200);
      expect(summary.body.eligibility.hasPurchased).toBe(false);
      await http().delete(`/api/v1/reviews/${created.body.id}`).set(visitor.auth).expect(204);
    });
  });

  describe('wishlist', () => {
    it('adds, lists, removes and moves products to the cart', async () => {
      const user = await customer();
      await http().get('/api/v1/wishlist').expect(401);
      const empty = await http().get('/api/v1/wishlist').set(user.auth).expect(200);
      expect(empty.body).toEqual({ items: [], count: 0 });

      const added = await http().post(`/api/v1/wishlist/${productId}`).set(user.auth).expect(200);
      expect(added.body.count).toBe(1);
      expect(added.body.items[0].product).toMatchObject({
        slug: 'anker-nano-65w',
        price: expect.any(Number),
      });
      const again = await http().post(`/api/v1/wishlist/${productId}`).set(user.auth).expect(200);
      expect(again.body.count).toBe(1);
      await http().post(`/api/v1/wishlist/${otherProductId}`).set(user.auth).expect(200);
      const ids = await http().get('/api/v1/wishlist/ids').set(user.auth).expect(200);
      expect(ids.body).toEqual([otherProductId, productId]);
      await http()
        .post('/api/v1/wishlist/01a0f307-0000-7000-8000-000000000000')
        .set(user.auth)
        .expect(404);

      const moved = await http()
        .post(`/api/v1/wishlist/${productId}/move-to-cart`)
        .set(user.auth)
        .expect(200);
      expect(
        moved.body.cart.items.some((i: { variantId: string }) => i.variantId === variantId),
      ).toBe(true);
      expect(moved.body.wishlist.items.map((i: { productId: string }) => i.productId)).toEqual([
        otherProductId,
      ]);
      await http().post(`/api/v1/wishlist/${productId}/move-to-cart`).set(user.auth).expect(404);

      const removed = await http()
        .delete(`/api/v1/wishlist/${otherProductId}`)
        .set(user.auth)
        .expect(200);
      expect(removed.body.count).toBe(0);
      await http().delete(`/api/v1/wishlist/${otherProductId}`).set(user.auth).expect(200);

      // Wishlists are private.
      const other = await customer();
      await http().post(`/api/v1/wishlist/${productId}`).set(other.auth).expect(200);
      const mine = await http().get('/api/v1/wishlist').set(user.auth).expect(200);
      expect(mine.body.count).toBe(0);
    });
  });
});
