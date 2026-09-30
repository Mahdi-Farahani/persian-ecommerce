import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const API_PREFIX = '/api/v1';
export const PASSWORD = 'Passw0rd!123';

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.local`;
}

/** Persian digits so assertions can match rendered numbers. */
export function fa(value: string | number): string {
  return String(value).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!);
}

export function adminCredentials(): { email: string; password: string } {
  const email = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com';
  const password = process.env.E2E_ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    throw new Error('Set E2E_ADMIN_PASSWORD (or SEED_ADMIN_PASSWORD) to the seeded admin password');
  }
  return { email, password };
}

/** Registers through the UI and leaves the browser logged in. */
export async function registerViaUi(page: Page, email: string): Promise<void> {
  await page.goto('/register');
  await page.locator('input[name=firstName]').fill('علی');
  await page.locator('input[name=lastName]').fill('رضایی');
  await page.locator('input[name=email]').fill(email);
  await page.locator('input[name=password]').fill(PASSWORD);
  await page.locator('input[name=confirmPassword]').fill(PASSWORD);
  const terms = page.locator('input[type=checkbox]').first();
  if (await terms.count()) await terms.check();
  await page.getByRole('button', { name: 'ثبت‌نام' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/register'));
}

export async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.locator('input[name=identifier], input[name=email]').first().fill(email);
  await page.locator('input[name=password]').fill(password);
  await page.getByRole('button', { name: /ورود/ }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

/** API login for setup steps that do not need the browser. */
export async function apiLogin(
  request: APIRequestContext,
  identifier: string,
  password: string,
): Promise<string> {
  const res = await request.post(`${API_PREFIX}/auth/login`, {
    data: { identifier, password },
    headers: { 'X-Requested-With': 'e2e' },
  });
  expect(res.ok(), `login ${identifier}: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = (await res.json()) as { accessToken: string };
  return body.accessToken;
}

export function bearer(token: string): { Authorization: string; 'X-Requested-With': string } {
  return { Authorization: `Bearer ${token}`, 'X-Requested-With': 'e2e' };
}

/** Fills the checkout address form when the customer has no address yet. */
export async function fillCheckoutAddress(page: Page): Promise<void> {
  const addBtn = page.getByRole('button', { name: 'افزودن آدرس جدید' });
  if (await addBtn.count()) await addBtn.click();
  if (!(await page.getByLabel('نام گیرنده').count())) return;
  await page.getByLabel('عنوان آدرس (مثلاً خانه)').fill('خانه');
  await page.getByLabel('نام گیرنده').fill('علی رضایی');
  await page.getByLabel('شماره موبایل گیرنده').fill('09123456789');
  await page.getByLabel('کد پستی').fill('1234567890');
  const province = page.getByLabel('استان');
  try {
    await province.selectOption({ label: 'تهران' });
  } catch {
    await province.fill('تهران');
  }
  await page.getByLabel('شهر').fill('تهران');
  await page.getByLabel('نشانی کامل').fill('خیابان ولیعصر، کوچه ۱۲، پلاک ۳');
  await page
    .getByRole('button', { name: /ذخیره|ثبت آدرس/ })
    .first()
    .click();
  await expect(page.getByLabel('نام گیرنده')).toHaveCount(0);
}

/** Advances the checkout wizard until the pay button is visible. */
export async function reachPaymentStep(page: Page): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    if (await page.getByRole('button', { name: /ثبت سفارش و پرداخت/ }).count()) return;
    const next = page.getByRole('button', { name: /ادامه|مرحله بعد|بعدی/ }).first();
    if (!(await next.count())) break;
    await next.click();
    await page.waitForTimeout(800);
  }
  await expect(page.getByRole('button', { name: /ثبت سفارش و پرداخت/ })).toBeVisible();
}
