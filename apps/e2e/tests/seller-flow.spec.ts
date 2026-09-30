import { expect, test } from '@playwright/test';
import {
  adminCredentials,
  API_PREFIX,
  apiLogin,
  bearer,
  loginViaUi,
  PASSWORD,
  registerViaUi,
  uniqueEmail,
} from './helpers';

/**
 * Seller journey: apply (UI) → admin approval (API) → offer (API) → customer
 * buys it (API, mock gateway) → seller dispatches (UI) → delivery → settlement
 * visible in the portal.
 */
test.describe('seller flow', () => {
  test('sells, fulfils and gets settled', async ({ page, playwright, baseURL }) => {
    // One API context per actor so session cookies set by login/register never mix.
    const adminApi = await playwright.request.newContext({ baseURL });
    const sellerApi = await playwright.request.newContext({ baseURL });
    const customerApi = await playwright.request.newContext({ baseURL });
    const run = Date.now().toString(36);
    const sellerEmail = uniqueEmail('seller');
    await registerViaUi(page, sellerEmail);

    // Apply through the UI.
    await page.goto('/seller/apply');
    await page.locator('input[name="storeName"]').fill(`فروشگاه آزمون ${run}`);
    await page.locator('input[name="contactPhone"]').fill('09121234567');
    await page.getByRole('button', { name: /ثبت درخواست|ارسال درخواست/ }).click();
    await expect(page.getByText('در انتظار تأیید').first()).toBeVisible();

    // Admin approves (API) and the seller re-logs to pick up the role.
    const admin = adminCredentials();
    const adminToken = await apiLogin(adminApi, admin.email, admin.password);
    const sellers = await adminApi.get(
      `${API_PREFIX}/admin/sellers?status=PENDING&search=${encodeURIComponent(sellerEmail)}`,
      {
        headers: bearer(adminToken),
      },
    );
    const pending = ((await sellers.json()) as { items: Array<{ id: string }> }).items;
    expect(pending.length).toBe(1);
    const sellerId = pending[0]!.id;
    const approved = await adminApi.patch(`${API_PREFIX}/admin/sellers/${sellerId}/status`, {
      headers: bearer(adminToken),
      data: { status: 'APPROVED' },
    });
    expect(approved.ok()).toBeTruthy();

    await page.context().clearCookies();
    await loginViaUi(page, sellerEmail, PASSWORD);
    await page.goto('/seller');
    await expect(page.getByText(/فروشگاه آزمون/).first()).toBeVisible();

    // Offer on a catalogue product (API) shows in the portal and on the storefront.
    const sellerToken = await apiLogin(sellerApi, sellerEmail, PASSWORD);
    const product = await sellerApi.get(`${API_PREFIX}/products/anker-nano-65w`);
    const detail = (await product.json()) as {
      id: string;
      variants: Array<{ attributes: Array<{ attributeId: string; valueId: string }> }>;
    };
    const productId = detail.id;
    // Offers mirror the product's variant attributes (here: the first variant's colour).
    const attributeValues = detail.variants[0]!.attributes.map((a) => ({
      attributeId: a.attributeId,
      valueId: a.valueId,
    }));
    const offer = await sellerApi.post(`${API_PREFIX}/seller/products/${productId}/offers`, {
      headers: bearer(sellerToken),
      data: { sku: `E2E-SELLER-${run}`, price: 17_000_000, initialStock: 4, attributeValues },
    });
    expect(offer.ok()).toBeTruthy();
    const variantId = ((await offer.json()) as { variantId: string }).variantId;
    await page.goto('/seller/products');
    await expect(page.getByText(`E2E-SELLER-${run}`)).toBeVisible();
    await page.goto('/products/anker-nano-65w');
    await expect(page.getByText(/فروشگاه آزمون/).first()).toBeVisible();

    // A customer buys the seller's offer (API + mock gateway).
    const customerEmail = uniqueEmail('buyer');
    const reg = await customerApi.post(`${API_PREFIX}/auth/register`, {
      data: { email: customerEmail, password: PASSWORD, firstName: 'علی', lastName: 'رضایی' },
    });
    const customerToken = ((await reg.json()) as { accessToken: string }).accessToken;
    const address = await customerApi.post(`${API_PREFIX}/users/me/addresses`, {
      headers: bearer(customerToken),
      data: {
        title: 'خانه',
        recipientName: 'علی رضایی',
        recipientPhone: '09123456789',
        province: 'تهران',
        city: 'تهران',
        addressLine: 'خیابان ولیعصر ۱۲',
        postalCode: '1234567890',
      },
    });
    const cartAdd = await customerApi.post(`${API_PREFIX}/cart/items`, {
      headers: bearer(customerToken),
      data: { variantId, quantity: 1 },
    });
    expect(cartAdd.ok(), `cart: ${cartAdd.status()} ${await cartAdd.text()}`).toBeTruthy();
    const order = await customerApi.post(`${API_PREFIX}/checkout`, {
      headers: bearer(customerToken),
      data: {
        addressId: ((await address.json()) as { id: string }).id,
        shippingMethodCode: 'post-standard',
      },
    });
    expect(order.ok(), `checkout: ${order.status()} ${await order.text()}`).toBeTruthy();
    const orderId = ((await order.json()) as { id: string }).id;
    const payment = await customerApi.post(`${API_PREFIX}/payments`, {
      headers: bearer(customerToken),
      data: { orderId },
    });
    const authority = ((await payment.json()) as { payment: { providerAuthority: string } }).payment
      .providerAuthority;
    await customerApi.get(`${API_PREFIX}/payments/mock/callback?authority=${authority}&status=OK`, {
      maxRedirects: 0,
    });

    // Seller dispatches through the portal.
    await page.goto(`/seller/orders/${orderId}`);
    await expect(page.getByText(`E2E-SELLER-${run}`)).toBeVisible();
    // The shipment form is rendered inline while the seller still has to dispatch.
    const tracking = page.locator('input[name="trackingCode"]');
    await expect(tracking).toBeVisible();
    await tracking.fill(`TRK-${run}`);
    await page.getByRole('button', { name: /ثبت مرسوله/ }).click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    // The only seller has dispatched, so the order must now be SHIPPED.
    await expect
      .poll(async () => {
        const res = await adminApi.get(`${API_PREFIX}/admin/orders/${orderId}`, {
          headers: bearer(adminToken),
        });
        return ((await res.json()) as { status: string }).status;
      })
      .toBe('SHIPPED');

    // Delivery and settlement (API), visible in the portal.
    const delivered = await adminApi.patch(`${API_PREFIX}/admin/orders/${orderId}/status`, {
      headers: bearer(adminToken),
      data: { status: 'DELIVERED' },
    });
    expect(delivered.ok(), `deliver: ${delivered.status()} ${await delivered.text()}`).toBeTruthy();
    const settlement = await adminApi.post(`${API_PREFIX}/admin/sellers/${sellerId}/settlements`, {
      headers: bearer(adminToken),
      data: { note: 'e2e' },
    });
    expect(
      settlement.ok(),
      `settle: ${settlement.status()} ${await settlement.text()}`,
    ).toBeTruthy();
    await page.goto('/seller/settlements');
    await expect(page.getByText('در انتظار پرداخت').first()).toBeVisible();
  });
});
