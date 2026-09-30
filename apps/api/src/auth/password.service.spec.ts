import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes with argon2id and verifies', async () => {
    const hash = await service.hash('Secret123');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await service.verify(hash, 'Secret123')).toBe(true);
    expect(await service.verify(hash, 'secret123')).toBe(false);
  });

  it('produces unique salts', async () => {
    const [a, b] = await Promise.all([service.hash('same'), service.hash('same')]);
    expect(a).not.toBe(b);
  });

  it('never throws on malformed hashes', async () => {
    expect(await service.verify('not-a-hash', 'x')).toBe(false);
  });
});
