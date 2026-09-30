import type { Agent } from 'supertest';
import { OrdersService } from '../src/orders/orders.service.js';
import { bearer, loginAsAdmin, registerUser } from './utils/auth-helpers.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

const RUN = Date.now().toString(36);
const M = 1_000_000;
let phoneCounter = 0;

const validAddress = {
  title: 'خانه',
  recipientName: 'علی رضایی',
  recipientPhone: '09123456789',
  province: 'تهران',
  city: 'تهران',
  addressLine: 'خیابان ولیعصر، کوچه ۱۲، پلاک ۳',
  postalCode: '1234567890',
};

interface Customer {
  auth: { Authorization: string };
  addressId: string;
}

describe('Inventory (integration)', () => {
  let ctx: TestApp;
  let admin: { Authorization: string };
  let variantId: string; // dedicated variant with 3 units
  let productId: string;

  const http = (): Agent => ctx.http();

  async function newCustomer(): Promise<Customer> {
    phoneCounter += 1;
    const registered = await registerUser(ctx, {
      phone: `09${String(Date.now()).slice(-6)}${String(phoneCounter).padStart(3, '0')}`,
    });
    const auth = bearer(registered);
    const address = await http()
      .post('/api/v1/users/me/addresses')
      .set(auth)
      .send(validAddress)
      .expect(201);
    return { auth, addressId: address.body.id };
  }

  async function checkout(customer: Customer, quantity: number) {
    await http()
      .post('/api/v1/cart/items')
      .set(customer.auth)
      .send({ variantId, quantity })
      .expect(201);
    return http()
      .post('/api/v1/checkout')
      .set(customer.auth)
      .send({ addressId: customer.addressId, shippingMethodCode: 'post-standard' });
  }

  async function placeOrder(customer: Customer, quantity: number) {
    const res = await checkout(customer, quantity);
    expect(res.status).toBe(201);
    return res.body as { id: string };
  }

  async function snapshot() {
    const res = await http().get(`/api/v1/admin/inventory/${variantId}`).set(admin).expect(200);
    return res.body as {
      stockQuantity: number;
      reservedQuantity: number;
      availableQuantity: number;
      lowStock: boolean;
    };
  }

  async function payMock(customer: Customer, orderId: string): Promise<void> {
    const created = await http()
      .post('/api/v1/payments')
      .set(customer.auth)
      .send({ orderId })
      .expect(201);
    await http()
      .get(
        `/api/v1/payments/mock/callback?authority=${created.body.payment.providerAuthority}&status=OK`,
      )
      .expect(303);
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = bearer(await loginAsAdmin(ctx));
    await http()
      .patch('/api/v1/admin/payment-gateways/mock')
      .set(admin)
      .send({ enabled: true, isDefault: true, environment: 'SANDBOX' })
      .expect(200);
    const categories = await http().get('/api/v1/admin/categories').set(admin).expect(200);
    const categoryId = categories.body.find((c: { slug: string }) => c.slug === 'smartphones').id;
    const brands = await http().get('/api/v1/admin/brands').set(admin).expect(200);
    const created = await http()
      .post('/api/v1/admin/products')
      .set(admin)
      .send({
        title: `کالای موجودی ${RUN}`,
        titleEn: `Inventory Item ${RUN}`,
        categoryId,
        brandId: brands.body.items[0].id,
        shortDescription: 'برای آزمون موجودی',
        description: 'توضیحات',
        status: 'ACTIVE',
        variants: [
          {
            sku: `INV-${RUN}`,
            price: 2 * M,
            isDefault: true,
            initialStock: 3,
            lowStockThreshold: 2,
          },
        ],
      })
      .expect(201);
    productId = created.body.id;
    variantId = created.body.variants[0].id;
  });

  afterAll(async () => {
    // Release reservations held by orders this suite left unpaid.
    await ctx.app.get(OrdersService).expireUnpaid(new Date(Date.now() + 365 * 24 * 3_600_000));
    await ctx.close();
  });

  it('never oversells under concurrent checkouts', async () => {
    const customers = await Promise.all([
      newCustomer(),
      newCustomer(),
      newCustomer(),
      newCustomer(),
    ]);
    const results = await Promise.all(customers.map((c) => checkout(c, 2)));
    const statuses = results.map((r) => r.status).sort();
    // 3 units: exactly one order of 2 succeeds, the rest fail with INSUFFICIENT_STOCK.
    expect(statuses).toEqual([201, 422, 422, 422]);
    const failed = results.find((r) => r.status === 422)!;
    expect(failed.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(failed.body.error.details.shortages[0]).toMatchObject({ variantId, requested: 2 });
    const after = await snapshot();
    expect(after).toMatchObject({
      stockQuantity: 3,
      reservedQuantity: 2,
      availableQuantity: 1,
      lowStock: true,
    });

    // The failed customers still hold their cart; the winner's cart is converted.
    const winner = customers[results.findIndex((r) => r.status === 201)]!;
    const winnerCart = await http().get('/api/v1/cart').set(winner.auth).expect(200);
    expect(winnerCart.body.items).toEqual([]);

    // Release the reservation by cancelling the order.
    const orderId = results.find((r) => r.status === 201)!.body.id as string;
    await http().post(`/api/v1/orders/${orderId}/cancel`).set(winner.auth).expect(200);
    expect(await snapshot()).toMatchObject({
      stockQuantity: 3,
      reservedQuantity: 0,
      availableQuantity: 3,
    });
  });

  it('deducts stock on sale and restocks on return through the ledger', async () => {
    const customer = await newCustomer();
    const order = await placeOrder(customer, 1);
    expect(await snapshot()).toMatchObject({ stockQuantity: 3, reservedQuantity: 1 });

    await payMock(customer, order.id);
    expect(await snapshot()).toMatchObject({
      stockQuantity: 2,
      reservedQuantity: 0,
      availableQuantity: 2,
    });

    for (const status of [
      'PROCESSING',
      'PACKED',
      'SHIPPED',
      'DELIVERED',
      'RETURN_REQUESTED',
      'RETURNED',
    ]) {
      await http()
        .patch(`/api/v1/admin/orders/${order.id}/status`)
        .set(admin)
        .send({ status })
        .expect(200);
    }
    expect(await snapshot()).toMatchObject({
      stockQuantity: 3,
      reservedQuantity: 0,
      availableQuantity: 3,
    });

    const ledger = await http()
      .get(`/api/v1/admin/inventory/${variantId}/transactions`)
      .set(admin)
      .expect(200);
    const types = ledger.body.map((t: { type: string }) => t.type);
    expect(types.slice(0, 3)).toEqual(['RETURN', 'SALE', 'RESERVATION']);
    expect(ledger.body[0]).toMatchObject({
      quantity: 1,
      stockAfter: 3,
      referenceType: 'order',
      referenceId: order.id,
    });
  });

  it('cancelling a paid order restocks the sold units', async () => {
    const customer = await newCustomer();
    const order = await placeOrder(customer, 2);
    await payMock(customer, order.id);
    expect(await snapshot()).toMatchObject({ stockQuantity: 1, availableQuantity: 1 });
    await http()
      .patch(`/api/v1/admin/orders/${order.id}/status`)
      .set(admin)
      .send({ status: 'CANCELLED', note: 'عدم تأمین' })
      .expect(200);
    expect(await snapshot()).toMatchObject({ stockQuantity: 3, reservedQuantity: 0 });
  });

  it('applies manual adjustments with guards and audit', async () => {
    const purchase = await http()
      .patch(`/api/v1/admin/inventory/${variantId}/adjust`)
      .set(admin)
      .send({ quantity: 7, type: 'PURCHASE', note: 'خرید از تأمین‌کننده' })
      .expect(200);
    expect(purchase.body).toMatchObject({ stockQuantity: 10, lowStock: false });

    const negative = await http()
      .patch(`/api/v1/admin/inventory/${variantId}/adjust`)
      .set(admin)
      .send({ quantity: -11 })
      .expect(422);
    expect(negative.body.error.code).toBe('INVENTORY_NEGATIVE');

    // Reserve 2, then try to adjust below the reservation.
    const customer = await newCustomer();
    const order = await placeOrder(customer, 2);
    const belowReserved = await http()
      .patch(`/api/v1/admin/inventory/${variantId}/adjust`)
      .set(admin)
      .send({ quantity: -9 })
      .expect(422);
    expect(belowReserved.body.error.code).toBe('INVENTORY_BELOW_RESERVED');
    await http().post(`/api/v1/orders/${order.id}/cancel`).set(customer.auth).expect(200);

    const threshold = await http()
      .patch(`/api/v1/admin/inventory/${variantId}/threshold`)
      .set(admin)
      .send({ lowStockThreshold: 10 })
      .expect(200);
    expect(threshold.body.lowStock).toBe(true);

    const audits = await ctx.prisma.auditLog.findMany({
      where: { entityId: variantId, action: { in: ['inventory.adjust', 'inventory.threshold'] } },
    });
    expect(audits.length).toBeGreaterThanOrEqual(2);

    await http()
      .patch(`/api/v1/admin/inventory/${variantId}/adjust`)
      .set(admin)
      .send({ quantity: 0 })
      .expect(422);
    await http()
      .patch(`/api/v1/admin/inventory/${variantId}/adjust`)
      .send({ quantity: 1 })
      .expect(401);
  });

  it('lists inventory with filters and summarises it', async () => {
    const all = await http()
      .get(`/api/v1/admin/inventory?productId=${productId}`)
      .set(admin)
      .expect(200);
    expect(all.body.items).toHaveLength(1);
    expect(all.body.items[0]).toMatchObject({
      variantId,
      sku: `INV-${RUN}`,
      productTitle: `کالای موجودی ${RUN}`,
      stockQuantity: 10,
      lowStock: true,
    });

    const low = await http()
      .get(`/api/v1/admin/inventory?lowStock=true&search=INV-${RUN}`)
      .set(admin)
      .expect(200);
    expect(low.body.items.map((i: { variantId: string }) => i.variantId)).toContain(variantId);

    const out = await http()
      .get(`/api/v1/admin/inventory?outOfStock=true&search=INV-${RUN}`)
      .set(admin)
      .expect(200);
    expect(out.body.items).toHaveLength(0);

    const seededOut = await http()
      .get('/api/v1/admin/inventory?outOfStock=true&search=SM-S25-256-BLU')
      .set(admin)
      .expect(200);
    expect(seededOut.body.items[0]).toMatchObject({ sku: 'SM-S25-256-BLU', availableQuantity: 0 });

    const summary = await http().get('/api/v1/admin/inventory/summary').set(admin).expect(200);
    expect(summary.body.trackedVariants).toBeGreaterThan(1);
    expect(summary.body.lowStockVariants).toBeGreaterThanOrEqual(1);
    expect(summary.body.outOfStockVariants).toBeGreaterThanOrEqual(1);
    expect(summary.body.stockUnits).toBeGreaterThanOrEqual(10);

    const customer = await newCustomer();
    await http().get('/api/v1/admin/inventory').set(customer.auth).expect(403);
  });
});
