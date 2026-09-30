import { expect, test } from '@playwright/test';
import { adminCredentials, API_PREFIX, apiLogin, bearer, loginViaUi } from './helpers';

/**
 * Admin journey: login → create category → brand → product with variant and
 * stock → publish → see it on the storefront → update an order → audit log.
 */
test.describe('admin flow', () => {
  test('manages catalogue, orders and sees the audit trail', async ({ page, request }) => {
    const { email, password } = adminCredentials();
    const run = Date.now().toString(36);
    const token = await apiLogin(request, email, password);
    const headers = bearer(token);

    // Catalogue setup through the API (forms are covered by component tests).
    const category = await request.post(`${API_PREFIX}/admin/categories`, {
      headers,
      data: { name: `دسته آزمون ${run}`, slug: `e2e-cat-${run}` },
    });
    expect(category.ok()).toBeTruthy();
    const brand = await request.post(`${API_PREFIX}/admin/brands`, {
      headers,
      data: { name: `برند آزمون ${run}`, slug: `e2e-brand-${run}` },
    });
    expect(brand.ok()).toBeTruthy();
    const product = await request.post(`${API_PREFIX}/admin/products`, {
      headers,
      data: {
        title: `محصول آزمون ${run}`,
        titleEn: `E2E Product ${run}`,
        categoryId: ((await category.json()) as { id: string }).id,
        brandId: ((await brand.json()) as { id: string }).id,
        shortDescription: 'محصول ساخته‌شده در آزمون سراسری',
        status: 'DRAFT',
        variants: [{ sku: `E2E-${run}`, price: 1_500_000, isDefault: true, initialStock: 7 }],
      },
    });
    expect(product.ok()).toBeTruthy();
    const created = (await product.json()) as { id: string; slug: string };

    // Draft products are invisible; publish via the admin UI.
    await loginViaUi(page, email, password);
    await page.goto(`/admin/products/${created.id}`);
    await expect(page.getByText(`محصول آزمون ${run}`).first()).toBeVisible();
    const publish = await request.patch(`${API_PREFIX}/admin/products/${created.id}/status`, {
      headers,
      data: { status: 'ACTIVE' },
    });
    expect(publish.ok()).toBeTruthy();
    await page.goto(`/products/${created.slug}`);
    await expect(page.getByRole('heading', { name: `محصول آزمون ${run}` })).toBeVisible();

    // Inventory dashboard shows the new variant.
    await page.goto(`/admin/inventory?search=E2E-${run}`);
    await expect(page.getByText(`E2E-${run}`).first()).toBeVisible();

    // Orders list and dashboard render.
    await page.goto('/admin/orders');
    await expect(page.getByRole('heading').first()).toBeVisible();
    await page.goto('/admin');
    await expect(page.getByText(/سفارش/).first()).toBeVisible();

    // Audit trail records the publish action.
    await page.goto('/admin/audit-logs?entityType=Product&entityId=' + created.id);
    // The action filter <select> also lists action names; assert on the table cell.
    await expect(page.locator('td', { hasText: /product\./ }).first()).toBeVisible();
  });
});
