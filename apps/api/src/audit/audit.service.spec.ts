import { redactSecrets } from './audit.service.js';

describe('redactSecrets', () => {
  it('masks keys that look like secrets at any depth', () => {
    const input = {
      email: 'a@b.c',
      password: 'p',
      nested: { apiKey: 'k', list: [{ clientSecret: 's', ok: 1 }] },
    };
    expect(redactSecrets(input)).toEqual({
      email: 'a@b.c',
      password: '[redacted]',
      nested: { apiKey: '[redacted]', list: [{ clientSecret: '[redacted]', ok: 1 }] },
    });
  });

  it('passes primitives through', () => {
    expect(redactSecrets('x')).toBe('x');
    expect(redactSecrets(5)).toBe(5);
    expect(redactSecrets(null)).toBeNull();
  });
});
