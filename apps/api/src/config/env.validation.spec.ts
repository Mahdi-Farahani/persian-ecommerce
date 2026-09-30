import { validateEnvironment } from './env.validation.js';

describe('validateEnvironment', () => {
  const base = {
    DATABASE_URL: 'mysql://app:pw@localhost:3306/db',
    JWT_ACCESS_SECRET: 'unit-test-secret-that-is-long-enough-0123456789',
    PAYMENT_ENCRYPTION_KEY: 'unit-test-payment-key-0123456789abcdef0123456789',
  };

  it('applies defaults', () => {
    const env = validateEnvironment({ ...base });
    expect(env.API_PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.API_GLOBAL_PREFIX).toBe('api/v1');
  });

  it('coerces numbers and booleans', () => {
    const env = validateEnvironment({ ...base, API_PORT: '5000', SWAGGER_ENABLED: 'false' });
    expect(env.API_PORT).toBe(5000);
    expect(env.SWAGGER_ENABLED).toBe(false);
  });

  it('rejects a missing database url', () => {
    expect(() => validateEnvironment({})).toThrow(/DATABASE_URL/);
  });

  it('rejects a short jwt secret', () => {
    expect(() => validateEnvironment({ ...base, JWT_ACCESS_SECRET: 'short' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('rejects invalid node env', () => {
    expect(() => validateEnvironment({ ...base, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });
});
