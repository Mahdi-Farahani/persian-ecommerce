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
  test('sells, fulfils and gets settled', async ({ page, request }) => {
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
    const adminToken = await apiLogin(request, admin.email, admin.password);
    const sellers = await request.get(
      `${API_PREFIX}/admin/sellers?status=PENDING&search=${encodeURIComponent(sellerEmail)}`,
      {
        headers: bearer(adminToken),
      },
    );
    const pending = ((await sellers.json()) as { items: Array<{ id: string }> }).items;
    expect(pending.length).toBe(1);
    const sellerId = pending[0]!.id;
    const approved = await request.patch(`${API_PREFIX}/admin/sellers/${sellerId}/status`, {
      headers: bearer(adminToken),
      data: { status: 'APPROVED' },
    });
    expect(approved.ok()).toBeTruthy();

    await page.context().clearCookies();
    await loginViaUi(page, sellerEmail, PASSWORD);
    await page.goto('/seller');
    await expect(page.getByText(/فروشگاه آزمون/).first()).toBeVisible();

    // Offer on a catalogue product (API) shows in the portal and on the storefront.
    const sellerToken = await apiLogin(request, sellerEmail, PASSWORD);
    const product = await request.get(`${API_PREFIX}/products/anker-nano-65w`);
    const productId = ((await product.json()) as { id: string }).id;
    const offer = await request.post(`${API_PREFIX}/seller/products/${productId}/offers`, {
      headers: bearer(sellerToken),
      data: { sku: `E2E-SELLER-${run}`, price: 17_000_000, initialStock: 4 },
    });
    expect(offer.ok()).toBeTruthy();
    const variantId = ((await offer.json()) as { variantId: string }).variantId;
    await page.goto('/seller/products');
    await expect(page.getByText(`E2E-SELLER-${run}`)).toBeVisible();
    await page.goto('/products/anker-nano-65w');
    await expect(page.getByText(/فروشگاه آزمون/).first()).toBeVisible();

    // A customer buys the seller's offer (API + mock gateway).
    const customerEmail = uniqueEmail('buyer');
    const reg = await request.post(`${API_PREFIX}/auth/register`, {
      data: { email: customerEmail, password: PASSWORD, firstName: 'علی', lastName: 'رضایی' },
    });
    const customerToken = ((await reg.json()) as { accessToken: string }).accessToken;
    const address = await request.post(`${API_PREFIX}/users/me/addresses`, {
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
    await request.post(`${API_PREFIX}/cart/items`, {
      headers: bearer(customerToken),
      data: { variantId, quantity: 1 },
    });
    const order = await request.post(`${API_PREFIX}/checkout`, {
      headers: bearer(customerToken),
      data: {
        addressId: ((await address.json()) as { id: string }).id,
        shippingMethodCode: 'post-standard',
      },
    });
    expect(order.ok()).toBeTruthy();
    const orderId = ((await order.json()) as { id: string }).id;
    const payment = await request.post(`${API_PREFIX}/payments`, {
      headers: bearer(customerToken),
      data: { orderId },
    });
    const authority = ((await payment.json()) as { payment: { providerAuthority: string } }).payment
      .providerAuthority;
    await request.get(`${API_PREFIX}/payments/mock/callback?authority=${authority}&status=OK`, {
      maxRedirects: 0,
    });

    // Seller dispatches through the portal.
    await page.goto(`/seller/orders/${orderId}`);
    await expect(page.getByText(`E2E-SELLER-${run}`)).toBeVisible();
    await page
      .getByRole('button', { name: /ثبت مرسوله/ })
      .first()
      .click();
    const tracking = page.locator('input[name="trackingCode"]');
    if (await tracking.count()) await tracking.fill(`TRK-${run}`);
    await page
      .getByRole('button', { name: /ثبت مرسوله|ثبت/ })
      .last()
      .click();
    await expect(page.getByRole('alert').first()).toBeVisible();

    // Delivery and settlement (API), visible in the portal.
    const delivered = await request.patch(`${API_PREFIX}/admin/orders/${orderId}/status`, {
      headers: bearer(adminToken),
      data: { status: 'DELIVERED' },
    });
    expect(delivered.ok()).toBeTruthy();
    const settlement = await request.post(`${API_PREFIX}/admin/sellers/${sellerId}/settlements`, {
      headers: bearer(adminToken),
      data: { note: 'e2e' },
    });
    expect(settlement.ok()).toBeTruthy();
    await page.goto('/seller/settlements');
    await expect(page.getByText('در انتظار پرداخت').first()).toBeVisible();
  });
});
