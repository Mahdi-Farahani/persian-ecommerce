import { defineConfig, devices } from '@playwright/test';

/**
 * Runs against an already running stack. Defaults target the Docker Compose
 * stack through nginx (http://localhost:8080). Override with E2E_BASE_URL.
 * Requires PAYMENT_MOCK_ENABLED=true and API_NODE_ENV=development on the API
 * so the mock gateway is offered at checkout.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    locale: 'fa-IR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
      : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
