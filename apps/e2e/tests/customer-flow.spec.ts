import { expect, test } from '@playwright/test';
import { fillCheckoutAddress, reachPaymentStep, registerViaUi, uniqueEmail } from './helpers';

/**
 * Critical customer journey: register → browse → search → product → variant
 * → cart → checkout (address, shipping, coupon step) → mock payment → order →
 * order history → review.
 */
test.describe('customer flow', () => {
  test('buys a product through the mock gateway and reviews it', async ({ page }) => {
    const email = uniqueEmail('customer');
    await registerViaUi(page, email);

    // Browse a category from the home page.
    await page.goto('/categories');
    await page.locator('a[href^="/categories/"]').first().click();
    await expect(page.locator('a[href^="/products/"]').first()).toBeVisible();

    // Search with autocomplete.
    const box = page.getByRole('combobox').first();
    await box.fill('سامس');
    await expect(page.locator('[role="listbox"] [role="option"]').first()).toBeVisible();
    // Enter would open the highlighted suggestion; the button submits the query.
    await page.getByRole('button', { name: 'جستجو' }).first().click();
    await page.waitForURL(/\/search\?q=/);
    await expect(page.locator('a[href^="/products/"]').first()).toBeVisible();

    // Product page: select a variant and add to cart.
    await page.goto('/products/samsung-galaxy-s25');
    const option = page.getByRole('radio').first();
    if (await option.count()) await option.check({ force: true });
    await page
      .getByRole('button', { name: /افزودن به سبد/ })
      .first()
      .click();
    await expect(page.getByRole('status').first()).toBeVisible();

    // Cart shows the line and totals in Toman.
    await page.goto('/cart');
    await expect(page.getByText('تومان').first()).toBeVisible();
    await expect(page.locator('a[href="/products/samsung-galaxy-s25"]').first()).toBeVisible();

    // Checkout: address, shipping, review with coupon field, payment.
    await page.goto('/checkout', { waitUntil: 'domcontentloaded' });
    await fillCheckoutAddress(page);
    await reachPaymentStep(page);
    await expect(page.getByRole('radio').first()).toBeVisible(); // payment providers
    await page.getByRole('button', { name: /ثبت سفارش و پرداخت/ }).click();
    await page.waitForURL(/\/api\/v1\/payments\/mock\/gateway/);
    await page.click('[data-testid="mock-pay"]');
    await page.waitForURL(/\/payment\/success/);
    const orderNumber = (await page.locator('body').innerText()).match(/PE-[۰-۹\d]{6}/)?.[0];
    expect(orderNumber).toBeTruthy();

    // Order history and detail.
    await page.goto('/account/orders');
    await expect(page.locator('a[href^="/account/orders/"]').first()).toBeVisible();
    await page.locator('a[href^="/account/orders/"]').first().click();
    await page.waitForURL(/\/account\/orders\//);
    await expect(page.getByText('پرداخت‌شده').first()).toBeVisible();

    // Review the purchased product (goes to moderation).
    await page.goto('/products/samsung-galaxy-s25');
    const write = page.getByRole('button', { name: /ثبت نظر|نوشتن نظر/ }).first();
    if (await write.count()) await write.click();
    const stars = page.getByRole('radio', { name: /۵|5/ }).first();
    if (await stars.count()) await stars.check({ force: true });
    const title = page.locator('input[name="title"]').first();
    if (await title.count()) {
      await title.fill('عالی بود');
      await page
        .locator('textarea[name="body"]')
        .first()
        .fill('کیفیت ساخت و سرعت شارژ فوق‌العاده است.');
      await page
        .getByRole('button', { name: /ثبت نظر|ارسال/ })
        .last()
        .click();
      await expect(page.getByText(/پس از بررسی/).first()).toBeVisible();
    }
  });
});
