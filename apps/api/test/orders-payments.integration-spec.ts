import type { PaymentProviderInfo } from '@pe/shared';
import type { Agent } from 'supertest';
import { OrdersService } from '../src/orders/orders.service.js';
import { PaymentProviderFactory } from '../src/payments/payment-provider.factory.js';
import type { PaymentProvider } from '../src/payments/payment-provider.types.js';
import { MOCK_DEFINITION, MockPaymentProvider } from '../src/payments/providers/mock.provider.js';
import { bearer, CSRF_HEADER, loginAsAdmin, registerUser } from './utils/auth-helpers.js';
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

interface Customer {
  auth: { Authorization: string };
  addressId: string;
}

describe('Orders & payments (integration)', () => {
  let ctx: TestApp;
  let admin: { Authorization: string };
  let charger: string; // anker-nano-65w, 40 in stock
  let s25Black: string; // samsung-galaxy-s25 128 black, 12 in stock

  const http = (): Agent => ctx.http();

  async function newCustomer(): Promise<Customer> {
    const registered = await registerUser(ctx, { phone: `0912${String(Date.now()).slice(-7)}` });
    const auth = bearer(registered);
    const address = await http()
      .post('/api/v1/users/me/addresses')
      .set(auth)
      .send(validAddress)
      .expect(201);
    return { auth, addressId: address.body.id };
  }

  async function placeOrder(customer: Customer, variantId = charger, quantity = 1) {
    await http()
      .post('/api/v1/cart/items')
      .set(customer.auth)
      .send({ variantId, quantity })
      .expect(201);
    const res = await http()
      .post('/api/v1/checkout')
      .set(customer.auth)
      .send({ addressId: customer.addressId, shippingMethodCode: 'post-standard' })
      .expect(201);
    return res.body;
  }

  async function startPayment(customer: Customer, orderId: string, provider?: string) {
    const res = await http()
      .post('/api/v1/payments')
      .set(customer.auth)
      .send({ orderId, ...(provider ? { provider } : {}) })
      .expect(201);
    return res.body;
  }

  async function callback(authority: string, status: string, paymentId?: string) {
    const query = new URLSearchParams({ authority, status });
    if (paymentId) query.set('paymentId', paymentId);
    const res = await http().get(`/api/v1/payments/mock/callback?${query.toString()}`).expect(303);
    return new URL(res.headers.location as string);
  }

  async function stock(variantId: string): Promise<{ available: number; reserved: number }> {
    const res = await http().get(`/api/v1/admin/inventory/${variantId}`).set(admin).expect(200);
    return { available: res.body.availableQuantity, reserved: res.body.reservedQuantity };
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = bearer(await loginAsAdmin(ctx));
    const anker = await http().get('/api/v1/products/anker-nano-65w').expect(200);
    charger = anker.body.variants[0].id;
    const s25 = await http().get('/api/v1/products/samsung-galaxy-s25').expect(200);
    s25Black = s25.body.variants.find((v: { sku: string }) => v.sku === 'SM-S25-128-BLK').id;
    // Make sure the mock gateway is the enabled default whatever earlier runs did.
    await http()
      .patch('/api/v1/admin/payment-gateways/mock')
      .set(admin)
      .send({
        enabled: true,
        isDefault: true,
        environment: 'SANDBOX',
        settings: { autoOutcome: 'interactive' },
      })
      .expect(200);
  });

  afterAll(async () => {
    // Release reservations held by orders this suite left unpaid.
    await ctx.app.get(OrdersService).expireUnpaid(new Date(Date.now() + 365 * 24 * 3_600_000));
    await ctx.close();
  });

  describe('checkout → payment → verification', () => {
    it('lists the available providers with the default first', async () => {
      const res = await http().get('/api/v1/payments/providers').expect(200);
      const providers = res.body as PaymentProviderInfo[];
      expect(providers[0]).toMatchObject({
        provider: 'MOCK',
        isDefault: true,
        environment: 'SANDBOX',
      });
      expect(providers.some((p) => p.provider === 'SNAPP_PAY')).toBe(false);
    });

    it('places an order (reserving stock), pays through the mock gateway and finalizes it', async () => {
      const customer = await newCustomer();
      const before = await stock(charger);

      const order = await placeOrder(customer, charger, 2);
      expect(order.status).toBe('PENDING_PAYMENT');
      expect(order.number).toMatch(/^PE-\d{6}$/);
      expect(order.items[0]).toMatchObject({ quantity: 2, sku: expect.any(String) });
      expect(order.total).toBe(order.subtotal - order.discount + order.shippingFee);
      expect(order.payable).toBe(true);
      const reserved = await stock(charger);
      expect(reserved.available).toBe(before.available - 2);
      expect(reserved.reserved).toBe(before.reserved + 2);

      const cart = await http().get('/api/v1/cart').set(customer.auth).expect(200);
      expect(cart.body.items).toEqual([]);

      const created = await startPayment(customer, order.id);
      expect(created.payment).toMatchObject({
        status: 'REDIRECTED',
        provider: 'MOCK',
        attemptNumber: 1,
        amount: order.total,
        orderId: order.id,
      });
      expect(created.redirectMethod).toBe('GET');
      expect(created.redirectUrl).toContain('/api/v1/payments/mock/gateway?authority=MOCK-');

      // Creating again resumes the same open attempt (no duplicate provider transaction).
      const again = await startPayment(customer, order.id);
      expect(again.payment.id).toBe(created.payment.id);

      // The gateway page is served by the API in test/dev.
      const gatewayPath =
        new URL(created.redirectUrl).pathname + new URL(created.redirectUrl).search;
      const page = await http().get(gatewayPath).expect(200);
      expect(page.headers['content-type']).toContain('text/html');
      expect(page.text).toContain('data-testid="mock-pay"');

      const redirect = await callback(created.payment.providerAuthority, 'OK', created.payment.id);
      expect(redirect.pathname).toBe('/payment/success');
      expect(redirect.searchParams.get('paymentId')).toBe(created.payment.id);

      const payment = await http()
        .get(`/api/v1/payments/${created.payment.id}`)
        .set(customer.auth)
        .expect(200);
      expect(payment.body).toMatchObject({
        status: 'PAID',
        providerTransactionId: expect.stringMatching(/^MOCKREF-/),
        cardPanMask: '603799******0001',
      });
      expect(payment.body.verifiedAt).not.toBeNull();

      const paidOrder = await http()
        .get(`/api/v1/orders/${order.id}`)
        .set(customer.auth)
        .expect(200);
      expect(paidOrder.body.status).toBe('PAID');
      expect(paidOrder.body.paidAt).not.toBeNull();
      expect(paidOrder.body.payable).toBe(false);
      expect(paidOrder.body.payments).toHaveLength(1);
      const after = await stock(charger);
      expect(after.available).toBe(before.available - 2);
      expect(after.reserved).toBe(before.reserved);

      // Duplicate callback is idempotent: same redirect, no second ledger entry, no double sale.
      const dup = await callback(created.payment.providerAuthority, 'OK', created.payment.id);
      expect(dup.pathname).toBe('/payment/success');
      const detail = await http()
        .get(`/api/v1/admin/payments/${created.payment.id}`)
        .set(admin)
        .expect(200);
      expect(
        detail.body.transactions.filter(
          (t: { type: string; succeeded: boolean }) => t.type === 'PAYMENT' && t.succeeded,
        ),
      ).toHaveLength(2); // create + verify
      expect((await stock(charger)).available).toBe(before.available - 2);
      const paidAgain = await http()
        .get(`/api/v1/orders/${order.id}`)
        .set(customer.auth)
        .expect(200);
      expect(paidAgain.body.paidAt).toBe(paidOrder.body.paidAt);
      expect(paidAgain.body.statusHistory).toHaveLength(2);

      // The customer list shows the order; another customer cannot see it.
      const list = await http().get('/api/v1/orders').set(customer.auth).expect(200);
      expect(list.body.items.map((o: { id: string }) => o.id)).toContain(order.id);
      const stranger = await newCustomer();
      await http().get(`/api/v1/orders/${order.id}`).set(stranger.auth).expect(404);
      await http()
        .post('/api/v1/payments')
        .set(stranger.auth)
        .send({ orderId: order.id })
        .expect(404);
    });

    it('keeps the order payable after a failed attempt and succeeds on retry', async () => {
      const customer = await newCustomer();
      const order = await placeOrder(customer);
      const first = await startPayment(customer, order.id);

      const failed = await callback(first.payment.providerAuthority, 'FAIL', first.payment.id);
      expect(failed.pathname).toBe('/payment/failure');
      const p1 = await http()
        .get(`/api/v1/payments/${first.payment.id}`)
        .set(customer.auth)
        .expect(200);
      expect(p1.body).toMatchObject({ status: 'FAILED', errorCode: 'MOCK_DECLINED' });
      const stillPending = await http()
        .get(`/api/v1/orders/${order.id}`)
        .set(customer.auth)
        .expect(200);
      expect(stillPending.body.status).toBe('PENDING_PAYMENT');
      expect(stillPending.body.payable).toBe(true);

      const second = await startPayment(customer, order.id);
      expect(second.payment.id).not.toBe(first.payment.id);
      expect(second.payment.attemptNumber).toBe(2);
      const ok = await callback(second.payment.providerAuthority, 'OK');
      expect(ok.pathname).toBe('/payment/success');
      const paid = await http().get(`/api/v1/orders/${order.id}`).set(customer.auth).expect(200);
      expect(paid.body.status).toBe('PAID');
      expect(paid.body.payments.map((p: { status: string }) => p.status)).toEqual([
        'FAILED',
        'PAID',
      ]);
    });

    it('records user cancellation without contacting the provider', async () => {
      const customer = await newCustomer();
      const order = await placeOrder(customer);
      const created = await startPayment(customer, order.id);
      const redirect = await callback(created.payment.providerAuthority, 'NOK');
      expect(redirect.pathname).toBe('/payment/failure');
      const payment = await http()
        .get(`/api/v1/payments/${created.payment.id}`)
        .set(customer.auth)
        .expect(200);
      expect(payment.body).toMatchObject({ status: 'CANCELLED', errorCode: 'USER_CANCELLED' });
    });

    it('rejects unknown, mismatched and stale callbacks', async () => {
      const unknown = await callback('MOCK-doesnotexist', 'OK');
      expect(unknown.pathname).toBe('/payment/failure');
      expect(unknown.searchParams.get('reason')).toBe('PAYMENT_NOT_FOUND');

      const customer = await newCustomer();
      const order = await placeOrder(customer);
      const created = await startPayment(customer, order.id);
      // Hint points at our payment, but the authority belongs to someone else.
      const mismatch = await callback('MOCK-' + 'f'.repeat(24), 'OK', created.payment.id);
      expect(mismatch.pathname).toBe('/payment/failure');
      expect(mismatch.searchParams.get('reason')).toBe('TRANSACTION_MISMATCH');
      const untouched = await http()
        .get(`/api/v1/payments/${created.payment.id}`)
        .set(customer.auth)
        .expect(200);
      expect(untouched.body.status).toBe('REDIRECTED');

      await http().get('/api/v1/payments/nope/callback?authority=x&status=OK').expect(404);
    });

    it('fails verification on amount mismatch instead of marking the order paid', async () => {
      const factory = ctx.app.get(PaymentProviderFactory);
      const original = factory.register('MOCK', (context) => {
        const base = new MockPaymentProvider(context, 'http://localhost/mock');
        const tampered: PaymentProvider = {
          name: 'MOCK',
          definition: MOCK_DEFINITION,
          createPayment: (r) => base.createPayment(r),
          parseCallback: (p) => base.parseCallback(p),
          testConnection: () => base.testConnection(),
          verifyPayment: async (r) => {
            const result = await base.verifyPayment(r);
            return result.status === 'PAID' ? { ...result, amount: r.amount - 10 } : result;
          },
        };
        return tampered;
      });
      try {
        const customer = await newCustomer();
        const order = await placeOrder(customer);
        const created = await startPayment(customer, order.id);
        const redirect = await callback(created.payment.providerAuthority, 'OK');
        expect(redirect.pathname).toBe('/payment/failure');
        const payment = await http()
          .get(`/api/v1/payments/${created.payment.id}`)
          .set(customer.auth)
          .expect(200);
        expect(payment.body).toMatchObject({ status: 'FAILED', errorCode: 'AMOUNT_MISMATCH' });
        const stillPending = await http()
          .get(`/api/v1/orders/${order.id}`)
          .set(customer.auth)
          .expect(200);
        expect(stillPending.body.status).toBe('PENDING_PAYMENT');
      } finally {
        factory.register('MOCK', original!);
      }
    });

    it('lets the customer re-verify after a lost callback', async () => {
      const customer = await newCustomer();
      const order = await placeOrder(customer);
      const created = await startPayment(customer, order.id);
      // No callback ever arrived; the provider (mock) reports "not paid".
      const res = await http()
        .post(`/api/v1/payments/${created.payment.id}/verify`)
        .set(customer.auth)
        .set(CSRF_HEADER)
        .expect(200);
      expect(res.body.status).toBe('FAILED');
      expect(res.body.errorCode).toBe('MOCK_NOT_PAID');
    });

    it('refuses payments for orders that are not payable', async () => {
      const customer = await newCustomer();
      const order = await placeOrder(customer);
      const cancelled = await http()
        .post(`/api/v1/orders/${order.id}/cancel`)
        .set(customer.auth)
        .expect(200);
      expect(cancelled.body.status).toBe('CANCELLED');
      const res = await http()
        .post('/api/v1/payments')
        .set(customer.auth)
        .send({ orderId: order.id })
        .expect(422);
      expect(res.body.error.code).toBe('ORDER_NOT_PAYABLE');
      await http()
        .post('/api/v1/payments')
        .set(customer.auth)
        .send({ orderId: order.id, provider: 'ZARINPAL' })
        .expect(422);
    });
  });

  describe('expiry, cancellation and refunds', () => {
    it('expires unpaid orders, releases stock, and flags a late payment for refund', async () => {
      const customer = await newCustomer();
      const before = await stock(s25Black);
      const order = await placeOrder(customer, s25Black, 1);
      expect((await stock(s25Black)).available).toBe(before.available - 1);
      const created = await startPayment(customer, order.id);

      await ctx.prisma.order.update({
        where: { id: order.id },
        data: { paymentDeadlineAt: new Date(Date.now() - 60_000) },
      });
      const expired = await ctx.app.get(OrdersService).expireUnpaid();
      expect(expired).toBeGreaterThanOrEqual(1);
      const afterExpiry = await http()
        .get(`/api/v1/orders/${order.id}`)
        .set(customer.auth)
        .expect(200);
      expect(afterExpiry.body.status).toBe('CANCELLED');
      expect(afterExpiry.body.payments[0].status).toBe('EXPIRED');
      expect((await stock(s25Black)).available).toBe(before.available);

      // A late gateway callback for the expired attempt: money captured, order stays cancelled.
      const late = await callback(created.payment.providerAuthority, 'OK');
      expect(late.pathname).toBe('/payment/success');
      const flagged = await http()
        .get(`/api/v1/admin/payments/${created.payment.id}`)
        .set(admin)
        .expect(200);
      expect(flagged.body).toMatchObject({
        status: 'PAID',
        errorCode: 'ORDER_NOT_PENDING',
        orderStatus: 'CANCELLED',
      });
      expect((await stock(s25Black)).available).toBe(before.available);

      const refunded = await http()
        .post(`/api/v1/admin/payments/${created.payment.id}/refund`)
        .set(admin)
        .send({ reason: 'پرداخت پس از انقضا' })
        .expect(200);
      expect(refunded.body.status).toBe('REFUNDED');
      expect(
        refunded.body.transactions.some(
          (t: { type: string; succeeded: boolean }) => t.type === 'REFUND' && t.succeeded,
        ),
      ).toBe(true);
      const finalOrder = await http()
        .get(`/api/v1/admin/orders/${order.id}`)
        .set(admin)
        .expect(200);
      expect(finalOrder.body.status).toBe('REFUNDED');
    });

    it('does not refund a paid order that is still active', async () => {
      const customer = await newCustomer();
      const order = await placeOrder(customer);
      const created = await startPayment(customer, order.id);
      await callback(created.payment.providerAuthority, 'OK');
      const res = await http()
        .post(`/api/v1/admin/payments/${created.payment.id}/refund`)
        .set(admin)
        .send({})
        .expect(422);
      expect(res.body.error.code).toBe('ORDER_NOT_REFUNDABLE');
    });
  });

  describe('administration', () => {
    it('manages order status and shipments with validated transitions', async () => {
      const customer = await newCustomer();
      const order = await placeOrder(customer);
      const created = await startPayment(customer, order.id);
      await callback(created.payment.providerAuthority, 'OK');

      const list = await http()
        .get('/api/v1/admin/orders?status=PAID&limit=5')
        .set(admin)
        .expect(200);
      expect(list.body.items.some((o: { id: string }) => o.id === order.id)).toBe(true);
      const byNumber = await http()
        .get(`/api/v1/admin/orders?search=${order.number}`)
        .set(admin)
        .expect(200);
      expect(byNumber.body.items[0].id).toBe(order.id);

      const invalid = await http()
        .patch(`/api/v1/admin/orders/${order.id}/status`)
        .set(admin)
        .send({ status: 'DELIVERED' })
        .expect(422);
      expect(invalid.body.error.code).toBe('ORDER_TRANSITION_INVALID');
      await http()
        .patch(`/api/v1/admin/orders/${order.id}/status`)
        .set(admin)
        .send({ status: 'PAID' })
        .expect(422);

      const processing = await http()
        .patch(`/api/v1/admin/orders/${order.id}/status`)
        .set(admin)
        .send({ status: 'PROCESSING', note: 'آماده‌سازی' })
        .expect(200);
      expect(processing.body.status).toBe('PROCESSING');

      const shipped = await http()
        .post(`/api/v1/admin/orders/${order.id}/shipments`)
        .set(admin)
        .send({ carrier: 'پست', trackingCode: 'RR123456789IR' })
        .expect(201);
      expect(shipped.body.status).toBe('SHIPPED');
      expect(shipped.body.shipments[0]).toMatchObject({ trackingCode: 'RR123456789IR' });
      expect(shipped.body.statusHistory.map((h: { toStatus: string }) => h.toStatus)).toEqual([
        'PENDING_PAYMENT',
        'PAID',
        'PROCESSING',
        'PACKED',
        'SHIPPED',
      ]);

      // Customers cannot use admin endpoints.
      await http().get('/api/v1/admin/orders').set(customer.auth).expect(403);
      await http().get('/api/v1/admin/payments').set(customer.auth).expect(403);
      await http().get('/api/v1/admin/payment-gateways').set(customer.auth).expect(403);
    });

    it('reconciles an abandoned attempt against the provider', async () => {
      const customer = await newCustomer();
      const order = await placeOrder(customer);
      const created = await startPayment(customer, order.id);
      const res = await http()
        .post(`/api/v1/admin/payments/${created.payment.id}/reconcile`)
        .set(admin)
        .expect(200);
      expect(res.body.changed).toBe(true);
      expect(res.body.payment.status).toBe('FAILED');
      expect(
        res.body.payment.transactions.some((t: { type: string }) => t.type === 'INQUIRY'),
      ).toBe(true);

      const payments = await http()
        .get(`/api/v1/admin/payments?orderId=${order.id}`)
        .set(admin)
        .expect(200);
      expect(payments.body.items).toHaveLength(1);
      expect(payments.body.items[0]).toMatchObject({
        status: 'FAILED',
        customer: { id: expect.any(String) },
      });
    });

    it('stores gateway credentials encrypted and never returns them', async () => {
      const merchantId = '11111111-2222-4333-8444-555555555555';
      const updated = await http()
        .patch('/api/v1/admin/payment-gateways/zarinpal')
        .set(admin)
        .send({
          credentials: { merchantId },
          settings: { currency: 'IRT' },
          environment: 'SANDBOX',
        })
        .expect(200);
      const field = updated.body.credentialFields.find(
        (f: { key: string }) => f.key === 'merchantId',
      );
      expect(field).toMatchObject({ configured: true, secret: true, maskedValue: '••••••••5555' });
      expect(JSON.stringify(updated.body)).not.toContain(merchantId);
      expect(
        updated.body.settingFields.find((f: { key: string }) => f.key === 'currency').value,
      ).toBe('IRT');

      const row = await ctx.prisma.paymentProviderConfig.findUniqueOrThrow({
        where: { provider: 'ZARINPAL' },
      });
      expect(row.credentialsEncrypted).toMatch(/^v1:/);
      expect(row.credentialsEncrypted).not.toContain(merchantId);

      // Re-submitting the masked value keeps the stored credential.
      const kept = await http()
        .patch('/api/v1/admin/payment-gateways/zarinpal')
        .set(admin)
        .send({ credentials: { merchantId: '••••••••5555' } })
        .expect(200);
      expect(kept.body.credentialFields[0].maskedValue).toBe('••••••••5555');

      const invalid = await http()
        .patch('/api/v1/admin/payment-gateways/zarinpal')
        .set(admin)
        .send({ credentials: { merchantId: 'not-a-uuid' } })
        .expect(422);
      expect(invalid.body.error.code).toBe('PAYMENT_GATEWAY_INVALID_CREDENTIAL');

      // Going live needs explicit confirmation.
      const needsConfirm = await http()
        .patch('/api/v1/admin/payment-gateways/zarinpal')
        .set(admin)
        .send({ enabled: true, environment: 'PRODUCTION' })
        .expect(422);
      expect(needsConfirm.body.error.code).toBe('PAYMENT_GATEWAY_CONFIRM_PRODUCTION');

      // Unknown fields and unavailable providers are rejected; the audit trail records changes.
      await http()
        .patch('/api/v1/admin/payment-gateways/zarinpal')
        .set(admin)
        .send({ credentials: { apiKey: 'x' } })
        .expect(422);
      await http()
        .patch('/api/v1/admin/payment-gateways/does-not-exist')
        .set(admin)
        .send({})
        .expect(404);
      const audit = await ctx.prisma.auditLog.findFirst({
        where: { action: 'payment_gateway.update', entityId: 'ZARINPAL' },
        orderBy: { createdAt: 'desc' },
      });
      expect(audit).not.toBeNull();
      expect(JSON.stringify(audit!.metadata)).not.toContain(merchantId);

      // Restore: leave ZarinPal disabled in sandbox.
      await http()
        .patch('/api/v1/admin/payment-gateways/zarinpal')
        .set(admin)
        .send({ enabled: false, environment: 'SANDBOX' })
        .expect(200);
    });

    it('tests the mock gateway connection and creates a test payment', async () => {
      const test = await http()
        .post('/api/v1/admin/payment-gateways/mock/test')
        .set(admin)
        .expect(200);
      expect(test.body.ok).toBe(true);
      const view = await http().get('/api/v1/admin/payment-gateways/mock').set(admin).expect(200);
      expect(view.body.lastTestSucceeded).toBe(true);
      expect(view.body.lastTestedAt).not.toBeNull();

      const testPayment = await http()
        .post('/api/v1/admin/payment-gateways/mock/test-payment')
        .set(admin)
        .expect(200);
      expect(testPayment.body.supported).toBe(true);
      expect(testPayment.body.redirectUrl).toContain('/payments/mock/gateway');
      // The callback for a test payment lands on the admin page, never on a customer payment.
      const back = await http()
        .get(
          `/api/v1/payments/mock/callback?test=1&authority=${testPayment.body.authority}&status=OK`,
        )
        .expect(303);
      expect(back.headers.location).toContain(
        '/admin/settings/payment-gateways?test=MOCK&outcome=OK',
      );
    });

    it('refuses to enable adapters whose contract documentation is not confirmed', async () => {
      const creds = { clientId: 'c', clientSecret: 's', username: 'u', password: 'p' };
      const refused = await http()
        .patch('/api/v1/admin/payment-gateways/snapp-pay')
        .set(admin)
        .send({ enabled: true, credentials: creds })
        .expect(422);
      expect(refused.body.error.code).toBe('PAYMENT_GATEWAY_UNAVAILABLE');
      const view = await http()
        .get('/api/v1/admin/payment-gateways/snapp-pay')
        .set(admin)
        .expect(200);
      expect(view.body.available).toBe(false);
      expect(view.body.unavailableReason).toContain('مستندات');
      await http()
        .patch('/api/v1/admin/payment-gateways/snapp-pay')
        .set(admin)
        .send({ credentials: creds })
        .expect(200);
    });

    it('lists every known gateway with its documentation status', async () => {
      const res = await http().get('/api/v1/admin/payment-gateways').set(admin).expect(200);
      const providers = res.body.map((g: { provider: string }) => g.provider);
      expect(providers).toEqual(
        expect.arrayContaining(['ZARINPAL', 'SNAPP_PAY', 'DIGIPAY', 'TOROB_PAY', 'MOCK']),
      );
      const zarinpal = res.body.find((g: { provider: string }) => g.provider === 'ZARINPAL');
      expect(zarinpal.capabilities).toEqual(
        expect.arrayContaining(['create', 'verify', 'inquiry']),
      );
      expect(zarinpal.supportsSandbox).toBe(true);
    });
  });
});
