import { Test } from '@nestjs/testing';
import { AppConfigService } from '../config/app-config.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

const meta = { ipAddress: '127.0.0.1', userAgent: 'vitest' };

describe('AuthService.login', () => {
  const users = {
    findCredentialsByIdentifier: vi.fn(),
    recordLoginFailure: vi.fn(),
    recordLoginSuccess: vi.fn(),
    toAuthUser: vi.fn(() => ({ id: 'u1', roles: ['CUSTOMER'], permissions: [] })),
  };
  const passwords = { verify: vi.fn(), verifyDummy: vi.fn(), hash: vi.fn() };
  const tokens = {
    createSession: vi.fn(() =>
      Promise.resolve({ familyId: 'fam', refreshToken: 'rt', expiresAt: new Date() }),
    ),
    signAccessToken: vi.fn(() => Promise.resolve('access')),
    accessTtlSeconds: 900,
  };
  const config = { auth: { loginMaxFailedAttempts: 5, loginLockMinutes: 15 } };

  let service: AuthService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: PasswordService, useValue: passwords },
        { provide: TokenService, useValue: tokens },
        { provide: PrismaService, useValue: {} },
        { provide: AppConfigService, useValue: config },
        { provide: NotificationsService, useValue: {} },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  const activeUser = {
    id: 'u1',
    status: 'ACTIVE',
    passwordHash: 'h',
    lockedUntil: null,
    roles: [],
  };

  it('returns a generic error and equalises timing for unknown identifiers', async () => {
    users.findCredentialsByIdentifier.mockResolvedValue(null);
    await expect(
      service.login({ identifier: 'nobody@x.io', password: 'p' }, meta),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    expect(passwords.verifyDummy).toHaveBeenCalledWith('p');
  });

  it('issues tokens on success and resets failure counters', async () => {
    users.findCredentialsByIdentifier.mockResolvedValue(activeUser);
    passwords.verify.mockResolvedValue(true);
    const result = await service.login({ identifier: 'a@b.c', password: 'ok' }, meta);
    expect(result.accessToken).toBe('access');
    expect(result.refreshToken).toBe('rt');
    expect(users.recordLoginSuccess).toHaveBeenCalledWith('u1');
    expect(tokens.createSession).toHaveBeenCalledWith('u1', meta);
  });

  it('records failures and locks the account when the limit is reached', async () => {
    users.findCredentialsByIdentifier.mockResolvedValue(activeUser);
    passwords.verify.mockResolvedValue(false);
    users.recordLoginFailure.mockResolvedValueOnce(null);
    await expect(
      service.login({ identifier: 'a@b.c', password: 'bad' }, meta),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    users.recordLoginFailure.mockResolvedValueOnce(new Date(Date.now() + 60_000));
    await expect(
      service.login({ identifier: 'a@b.c', password: 'bad' }, meta),
    ).rejects.toMatchObject({
      code: 'ACCOUNT_LOCKED',
    });
    expect(users.recordLoginFailure).toHaveBeenCalledWith('u1', 5, 15);
  });

  it('rejects locked and disabled accounts before verifying the password', async () => {
    users.findCredentialsByIdentifier.mockResolvedValue({
      ...activeUser,
      lockedUntil: new Date(Date.now() + 60_000),
    });
    await expect(
      service.login({ identifier: 'a@b.c', password: 'ok' }, meta),
    ).rejects.toMatchObject({
      code: 'ACCOUNT_LOCKED',
    });
    users.findCredentialsByIdentifier.mockResolvedValue({ ...activeUser, status: 'SUSPENDED' });
    await expect(
      service.login({ identifier: 'a@b.c', password: 'ok' }, meta),
    ).rejects.toMatchObject({
      code: 'ACCOUNT_DISABLED',
    });
    expect(passwords.verify).not.toHaveBeenCalled();
  });
});
