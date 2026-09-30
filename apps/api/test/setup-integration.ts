/**
 * Runs in each integration test worker before the suite: points the
 * application at the isolated test database and fixes test-only settings.
 */
import 'dotenv/config';

const base = process.env['DATABASE_URL'];
if (!process.env['TEST_DATABASE_URL'] && base) {
  const url = new URL(base);
  url.pathname = `${url.pathname.replace(/\/$/, '')}_test`;
  process.env['TEST_DATABASE_URL'] = url.toString();
}

process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = process.env['TEST_DATABASE_URL'];
process.env['SWAGGER_ENABLED'] = 'false';
process.env['LOG_LEVEL'] = 'error';
process.env['APP_URL'] = 'http://localhost:3000';
process.env['CORS_ORIGINS'] = 'http://localhost:3000';
process.env['JWT_ACCESS_SECRET'] = 'integration-test-access-secret-0123456789abcdef';
process.env['JWT_ACCESS_TTL_SECONDS'] = '900';
process.env['COOKIE_SECURE'] = 'false';
process.env['THROTTLE_DISABLED'] = 'true';
process.env['PAYMENT_ENCRYPTION_KEY'] = 'integration-test-payment-key-0123456789abcdef0123456789';
process.env['PAYMENT_MOCK_ENABLED'] = 'true';
process.env['ORDER_PAYMENT_TIMEOUT_MINUTES'] = '30';
