import type { Agent } from 'supertest';
import { OrdersService } from '../src/orders/orders.service.js';
import { bearer, loginAs, loginAsAdmin, registerUser, uniqueEmail } from './utils/auth-helpers.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

const RUN = Date.now().toString(36);
const M = 1_000_000;

const validAddress = {
  title: 'خانه',
  recipientName: 'علی رضایی',
  recipientPhone: '09123456789',
  province: 'تهران',
  city: 'تهران',
  addressLine: 'خیابان ولیعصر، کوچه ۱۲، پلاک ۳',
  postalCode: '1234567890',
};

interface Actor {
  auth: { Authorization: string };
  id: string;
  email: string;
  password: string;
}

describe('Seller marketplace (integration)', () => {
  let ctx: TestApp;
  let admin: { Authorization: string };
  let sellerA: Actor;
  let sellerB: Actor;
  let sellerAId: string;
  let sellerBId: string;
  let productId: string; // samsung-galaxy-s25
  let offerA: string; // variant id of seller A's offer
  let platformVariant: string; // anker-nano-65w platform variant

  const http = (): Agent => ctx.http();

  async function actor(prefix = 'user'): Promise<Actor> {
    const email = uniqueEmail(prefix);
    const password = 'Passw0rd!123';
    const registered = await registerUser(ctx, { email, password });
    return { auth: bearer(registered), id: registered.user.id, email, password };
  }

  async function relogin(a: Actor): Promise<void> {
    a.auth = bearer(await loginAs(ctx, a.email, a.password));
  }

  async function approve(a: Actor): Promise<string> {
    const applied = await http()
      .post('/api/v1/seller/apply')
      .set(a.auth)
      .send({
        storeName: `فروشگاه ${a.email.split('@')[0]}`,
        contactPhone: '09121234567',
        iban: `IR${'1'.repeat(24)}`,
      })
      .expect(201);
    expect(applied.body).toMatchObject({
      status: 'PENDING',
      ibanMasked: 'IR11••••••••••••••••••1111',
    });
    expect(JSON.stringify(applied.body)).not.toContain('1'.repeat(24));
    // Pending sellers cannot use the portal.
    const blocked = await http().get('/api/v1/seller/products').set(a.auth).expect(403);
    expect(['PERMISSION_DENIED', 'SELLER_NOT_APPROVED']).toContain(blocked.body.error.code);
    const approved = await http()
      .patch(`/api/v1/admin/sellers/${applied.body.id}/status`)
      .set(admin)
      .send({ status: 'APPROVED' })
      .expect(200);
    expect(approved.body.status).toBe('APPROVED');
    await relogin(a);
    return applied.body.id as string;
  }

  async function buy(
    customer: Actor,
    lines: Array<{ variantId: string; quantity: number }>,
  ): Promise<string> {
    const address = await http()
      .post('/api/v1/users/me/addresses')
      .set(customer.auth)
      .send(validAddress)
      .expect(201);
    for (const line of lines) {
      await http().post('/api/v1/cart/items').set(customer.auth).send(line).expect(201);
    }
    const order = await http()
      .post('/api/v1/checkout')
      .set(customer.auth)
      .send({ addressId: address.body.id, shippingMethodCode: 'post-standard' })
      .expect(201);
    const payment = await http()
      .post('/api/v1/payments')
      .set(customer.auth)
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
    const s25 = await http().get('/api/v1/products/samsung-galaxy-s25').expect(200);
    productId = s25.body.id;
    const anker = await http().get('/api/v1/products/anker-nano-65w').expect(200);
    platformVariant = anker.body.variants[0].id;
    sellerA = await actor('seller-a');
    sellerB = await actor('seller-b');
  });

  afterAll(async () => {
    await ctx.app.get(OrdersService).expireUnpaid(new Date(Date.now() + 365 * 24 * 3_600_000));
    await ctx.close();
  });

  it('onboards sellers through application and admin approval, granting the SELLER role', async () => {
    sellerAId = await approve(sellerA);
    sellerBId = await approve(sellerB);
    const me = await loginAs(ctx, sellerA.email, sellerA.password);
    expect(me.user.roles).toContain('SELLER');
    expect(me.user.permissions).toContain('seller.portal');

    // One application per account; duplicate store names are refused.
    const dup = await http()
      .post('/api/v1/seller/apply')
      .set(sellerA.auth)
      .send({ storeName: 'فروشگاه دوم', contactPhone: '09121234567' })
      .expect(409);
    expect(dup.body.error.code).toBe('SELLER_EXISTS');
    const third = await actor('seller-c');
    const nameTaken = await http()
      .post('/api/v1/seller/apply')
      .set(third.auth)
      .send({ storeName: `فروشگاه ${sellerA.email.split('@')[0]}`, contactPhone: '09121234567' })
      .expect(409);
    expect(nameTaken.body.error.code).toBe('STORE_NAME_TAKEN');
    await http()
      .post('/api/v1/seller/apply')
      .set(third.auth)
      .send({ storeName: 'بد', contactPhone: '123' })
      .expect(400);

    const list = await http().get('/api/v1/admin/sellers?status=APPROVED').set(admin).expect(200);
    expect(list.body.items.map((s: { id: string }) => s.id)).toEqual(
      expect.arrayContaining([sellerAId, sellerBId]),
    );
    const publicView = await http().get(`/api/v1/sellers/${list.body.items[0].slug}`).expect(200);
    expect(Object.keys(publicView.body).sort()).toEqual(['description', 'id', 'slug', 'storeName']);
  });

  it('lets a seller add an offer that appears on the storefront with the seller identity', async () => {
    // Offers must mirror the product's variant-defining attributes.
    const s25 = await http().get('/api/v1/products/samsung-galaxy-s25').expect(200);
    const attributeValues = (
      s25.body.variants[0].attributes as Array<{ attributeId: string; valueId: string }>
    ).map((a) => ({ attributeId: a.attributeId, valueId: a.valueId }));
    const orphan = await http()
      .post(`/api/v1/seller/products/${productId}/offers`)
      .set(sellerA.auth)
      .send({ sku: `SELLER-A-ORPHAN-${RUN}`, price: 400 * M })
      .expect(422);
    expect(orphan.body.error.code).toBe('OFFER_ATTRIBUTES_MISMATCH');
    const created = await http()
      .post(`/api/v1/seller/products/${productId}/offers`)
      .set(sellerA.auth)
      .send({
        attributeValues,
        sku: `SELLER-A-${RUN}`,
        price: 400 * M,
        compareAtPrice: 450 * M,
        initialStock: 5,
        lowStockThreshold: 1,
      })
      .expect(201);
    offerA = created.body.variantId;
    expect(created.body).toMatchObject({
      productSlug: 'samsung-galaxy-s25',
      availableQuantity: 5,
      price: 400 * M,
    });

    const detail = await http().get('/api/v1/products/samsung-galaxy-s25').expect(200);
    const offer = detail.body.variants.find((v: { id: string }) => v.id === offerA);
    expect(offer.seller).toMatchObject({
      id: sellerAId,
      storeName: expect.any(String),
      slug: expect.any(String),
    });
    expect(detail.body.variants.some((v: { seller: unknown }) => v.seller === null)).toBe(true);
    // The card price is the cheapest active offer.
    const card = await http().get('/api/v1/products?q=Galaxy%20S25').expect(200);
    expect(card.body.items[0].price).toBeLessThanOrEqual(400 * M);

    // Sellers only see and change their own offers.
    const mine = await http().get('/api/v1/seller/products').set(sellerA.auth).expect(200);
    expect(mine.body.items.map((o: { variantId: string }) => o.variantId)).toEqual([offerA]);
    const others = await http().get('/api/v1/seller/products').set(sellerB.auth).expect(200);
    expect(others.body.items).toEqual([]);
    await http()
      .patch(`/api/v1/seller/offers/${offerA}`)
      .set(sellerB.auth)
      .send({ price: 1 * M })
      .expect(404);
    await http()
      .patch(`/api/v1/seller/inventory/${offerA}/adjust`)
      .set(sellerB.auth)
      .send({ quantity: 100 })
      .expect(404);
    await http()
      .patch(`/api/v1/seller/offers/${offerA}`)
      .set(sellerA.auth)
      .send({ price: 390 * M })
      .expect(200);
    const stock = await http()
      .patch(`/api/v1/seller/inventory/${offerA}/adjust`)
      .set(sellerA.auth)
      .send({ quantity: 3, note: 'ورود' })
      .expect(200);
    expect(stock.body.stockQuantity).toBe(8);
    const ledger = await http()
      .get(`/api/v1/seller/inventory/${offerA}/transactions`)
      .set(sellerA.auth)
      .expect(200);
    expect(ledger.body[0]).toMatchObject({ type: 'PURCHASE', referenceType: 'seller' });
    // Sellers cannot touch platform stock.
    await http()
      .patch(`/api/v1/seller/inventory/${platformVariant}/adjust`)
      .set(sellerA.auth)
      .send({ quantity: 1 })
      .expect(404);
  });

  it('splits an order across sellers, isolates order data and ships per seller', async () => {
    const customer = await actor('buyer');
    const orderId = await buy(customer, [
      { variantId: offerA, quantity: 2 },
      { variantId: platformVariant, quantity: 1 },
    ]);

    const adminOrder = await http().get(`/api/v1/admin/orders/${orderId}`).set(admin).expect(200);
    const sellerLine = adminOrder.body.items.find(
      (i: { variantId: string }) => i.variantId === offerA,
    );
    expect(sellerLine.seller.id).toBe(sellerAId);
    const platformLine = adminOrder.body.items.find(
      (i: { variantId: string }) => i.variantId === platformVariant,
    );
    expect(platformLine.seller).toBeNull();
    const customerOrder = await http()
      .get(`/api/v1/orders/${orderId}`)
      .set(customer.auth)
      .expect(200);
    expect(
      customerOrder.body.items.find((i: { variantId: string }) => i.variantId === offerA).seller
        .storeName,
    ).toBeDefined();

    // Commission snapshot: 10% default on the seller line, none on platform stock.
    const items = await ctx.prisma.orderItem.findMany({ where: { orderId } });
    const sellerItem = items.find((i) => i.variantId === offerA)!;
    expect(Number(sellerItem.lineTotal)).toBe(2 * 390 * M);
    expect(Number(sellerItem.commissionAmount)).toBe(Math.floor((2 * 390 * M * 1000) / 10_000));
    expect(Number(sellerItem.sellerAmount)).toBe(2 * 390 * M - Number(sellerItem.commissionAmount));
    const platformItem = items.find((i) => i.variantId === platformVariant)!;
    expect(Number(platformItem.commissionAmount)).toBe(0);

    // Seller A sees the order with only their line; seller B sees nothing.
    const sellerView = await http()
      .get(`/api/v1/seller/orders/${orderId}`)
      .set(sellerA.auth)
      .expect(200);
    expect(sellerView.body.items).toHaveLength(1);
    expect(sellerView.body.items[0]).toMatchObject({
      variantId: offerA,
      sellerAmount: Number(sellerItem.sellerAmount),
    });
    expect(sellerView.body.awaitingShipment).toBe(true);
    expect(sellerView.body.address.recipientPhone).toBe(validAddress.recipientPhone);
    await http().get(`/api/v1/seller/orders/${orderId}`).set(sellerB.auth).expect(404);
    const sellerList = await http()
      .get('/api/v1/seller/orders?awaitingShipment=true')
      .set(sellerA.auth)
      .expect(200);
    expect(sellerList.body.items.map((o: { id: string }) => o.id)).toContain(orderId);
    const sellerBList = await http().get('/api/v1/seller/orders').set(sellerB.auth).expect(200);
    expect(sellerBList.body.items.map((o: { id: string }) => o.id)).not.toContain(orderId);
    await http()
      .post(`/api/v1/seller/orders/${orderId}/shipments`)
      .set(sellerB.auth)
      .send({ carrier: 'x' })
      .expect(404);

    // Seller A ships their part: order moves to PROCESSING but not SHIPPED (platform line pending).
    const shipped = await http()
      .post(`/api/v1/seller/orders/${orderId}/shipments`)
      .set(sellerA.auth)
      .send({ carrier: 'تیپاکس', trackingCode: `TPX-${RUN}` })
      .expect(201);
    expect(shipped.body.status).toBe('PROCESSING');
    expect(shipped.body.awaitingShipment).toBe(false);
    expect(shipped.body.shipments).toHaveLength(1);
    const again = await http()
      .post(`/api/v1/seller/orders/${orderId}/shipments`)
      .set(sellerA.auth)
      .send({})
      .expect(422);
    expect(again.body.error.code).toBe('SHIPMENT_ALREADY_REGISTERED');

    // Platform ships the rest: order becomes SHIPPED; customer sees both shipments.
    const platformShip = await http()
      .post(`/api/v1/admin/orders/${orderId}/shipments`)
      .set(admin)
      .send({ carrier: 'پست', trackingCode: `POST-${RUN}` })
      .expect(201);
    expect(platformShip.body.status).toBe('SHIPPED');
    expect(platformShip.body.shipments).toHaveLength(2);
    const sellerAfter = await http()
      .get(`/api/v1/seller/orders/${orderId}`)
      .set(sellerA.auth)
      .expect(200);
    expect(sellerAfter.body.shipments).toHaveLength(1); // only their own

    // Deliver, then settle the seller's delivered items.
    await http()
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set(admin)
      .send({ status: 'DELIVERED' })
      .expect(200);
    const dashboard = await http().get('/api/v1/seller/dashboard').set(sellerA.auth).expect(200);
    expect(dashboard.body.settlements.pendingAmount).toBeGreaterThanOrEqual(
      Number(sellerItem.sellerAmount),
    );
    expect(dashboard.body.sales.last7Days.orders).toBeGreaterThanOrEqual(1);

    const empty = await http()
      .post(`/api/v1/admin/sellers/${sellerBId}/settlements`)
      .set(admin)
      .send({})
      .expect(422);
    expect(empty.body.error.code).toBe('SETTLEMENT_EMPTY');
    const settlement = await http()
      .post(`/api/v1/admin/sellers/${sellerAId}/settlements`)
      .set(admin)
      .send({ note: 'تسویه هفتگی' })
      .expect(201);
    expect(settlement.body).toMatchObject({
      status: 'PENDING',
      itemCount: 1,
      grossAmount: Number(sellerItem.lineTotal),
      commissionAmount: Number(sellerItem.commissionAmount),
      netAmount: Number(sellerItem.sellerAmount),
      seller: { id: sellerAId },
    });
    const noMore = await http()
      .post(`/api/v1/admin/sellers/${sellerAId}/settlements`)
      .set(admin)
      .send({})
      .expect(422);
    expect(noMore.body.error.code).toBe('SETTLEMENT_EMPTY');
    const paid = await http()
      .patch(`/api/v1/admin/settlements/${settlement.body.id}`)
      .set(admin)
      .send({ status: 'PAID', paymentReference: 'PAYA-123' })
      .expect(200);
    expect(paid.body).toMatchObject({ status: 'PAID', paymentReference: 'PAYA-123' });
    await http()
      .patch(`/api/v1/admin/settlements/${settlement.body.id}`)
      .set(admin)
      .send({ status: 'CANCELLED' })
      .expect(422);
    const mineSettlements = await http()
      .get('/api/v1/seller/settlements')
      .set(sellerA.auth)
      .expect(200);
    expect(mineSettlements.body.items[0].id).toBe(settlement.body.id);
    const bSettlements = await http()
      .get('/api/v1/seller/settlements')
      .set(sellerB.auth)
      .expect(200);
    expect(bSettlements.body.items).toEqual([]);
    const audit = await ctx.prisma.auditLog.findFirst({
      where: { action: 'settlement.paid', entityId: settlement.body.id },
    });
    expect(audit).not.toBeNull();
  });

  it('suspends a seller: offers disappear and portal access is revoked', async () => {
    await http()
      .patch(`/api/v1/admin/sellers/${sellerAId}/status`)
      .set(admin)
      .send({ status: 'SUSPENDED', reason: 'تخلف' })
      .expect(200);
    const detail = await http().get('/api/v1/products/samsung-galaxy-s25').expect(200);
    expect(detail.body.variants.some((v: { id: string }) => v.id === offerA)).toBe(false);
    await relogin(sellerA);
    const blocked = await http().get('/api/v1/seller/products').set(sellerA.auth).expect(403);
    expect(blocked.body.error.code).toBe('PERMISSION_DENIED');
    const profile = await http().get('/api/v1/seller/profile').set(sellerA.auth).expect(200);
    expect(profile.body.status).toBe('SUSPENDED');

    // Customers and other sellers never reach admin seller endpoints.
    await http().get('/api/v1/admin/sellers').set(sellerB.auth).expect(403);
    await http().get('/api/v1/admin/settlements').expect(401);
  });
});
