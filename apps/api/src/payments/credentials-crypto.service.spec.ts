import { describe, expect, it } from 'vitest';
import type { AppConfigService } from '../config/app-config.service.js';
import { CredentialsCryptoService, deriveKey, maskSecret } from './credentials-crypto.service.js';

function service(key = 'test-payment-encryption-key-with-32+chars'): CredentialsCryptoService {
  return new CredentialsCryptoService({ payments: { encryptionKey: key } } as AppConfigService);
}

describe('CredentialsCryptoService', () => {
  it('round-trips a credential map with a fresh IV per call', () => {
    const crypto = service();
    const creds = { merchantId: '11111111-2222-3333-4444-555555555555', token: 's3cr3t' };
    const a = crypto.encryptJson(creds);
    const b = crypto.encryptJson(creds);
    expect(a).not.toEqual(b);
    expect(a.startsWith('v1:')).toBe(true);
    expect(a).not.toContain('s3cr3t');
    expect(crypto.decryptJson(a)).toEqual(creds);
    expect(crypto.decryptJson(b)).toEqual(creds);
  });

  it('rejects tampered ciphertext', () => {
    const crypto = service();
    const payload = crypto.encrypt('hello');
    const [v, iv, tag, data] = payload.split(':');
    const flipped = data!.slice(0, -2) + (data!.endsWith('AA') ? 'BB' : 'AA');
    expect(() => crypto.decrypt([v, iv, tag, flipped].join(':'))).toThrow();
  });

  it('cannot decrypt with a different key', () => {
    const payload = service('key-one-with-enough-length-1234567890').encrypt('hello');
    expect(() => service('key-two-with-enough-length-1234567890').decrypt(payload)).toThrow();
  });

  it('derives keys from hex, base64url and passphrases', () => {
    expect(deriveKey('a'.repeat(64))).toHaveLength(32);
    expect(deriveKey(Buffer.alloc(32, 7).toString('base64url'))).toEqual(Buffer.alloc(32, 7));
    expect(deriveKey('some passphrase that is long enough to pass')).toHaveLength(32);
  });

  it('returns an empty map for missing or non-string values', () => {
    const crypto = service();
    expect(crypto.decryptJson(null)).toEqual({});
    const mixed = crypto.encrypt(JSON.stringify({ a: 'x', b: 1, c: null }));
    expect(crypto.decryptJson(mixed)).toEqual({ a: 'x' });
  });

  it('masks secrets keeping only the last four characters', () => {
    expect(maskSecret('short')).toBe('••••••••');
    expect(maskSecret('11111111-2222-3333-4444-555555555555')).toBe('••••••••5555');
  });
});
