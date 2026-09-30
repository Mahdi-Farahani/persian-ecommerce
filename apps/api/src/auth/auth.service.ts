import { createHash, randomBytes, randomInt } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { AuthResponse, AuthUser } from '@pe/shared';
import {
  AppException,
  ForbiddenAppException,
  UnauthorizedAppException,
  UnprocessableAppException,
} from '../common/errors/app.exception.js';
import { AppConfigService } from '../config/app-config.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RoleName } from '../rbac/permissions.js';
import { UsersService, type UserWithRoles } from '../users/users.service.js';
import type { ClientMetadata } from './auth.types.js';
import type {
  ChangePasswordDto,
  ConfirmVerificationDto,
  LoginDto,
  RegisterDto,
  RequestVerificationDto,
} from './dto/auth.dto.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

const MINUTE_MS = 60_000;
const RESET_TOKEN_BYTES = 32;
const VERIFICATION_MAX_ATTEMPTS = 5;
const VERIFICATION_CODE_MIN = 100_000;
const VERIFICATION_CODE_MAX = 1_000_000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async register(dto: RegisterDto, meta: ClientMetadata): Promise<AuthResponse> {
    const passwordHash = await this.passwords.hash(dto.password);
    const user = await this.users.create({
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      roleName: RoleName.Customer,
    });
    return this.issue(user, meta);
  }

  async login(dto: LoginDto, meta: ClientMetadata): Promise<AuthResponse> {
    const user = await this.users.findCredentialsByIdentifier(dto.identifier);
    if (!user) {
      await this.passwords.verifyDummy(dto.password);
      throw new UnauthorizedAppException(
        'INVALID_CREDENTIALS',
        'نام کاربری یا رمز عبور اشتباه است',
      );
    }
    if (user.status === 'SUSPENDED' || user.status === 'DELETED') {
      throw new ForbiddenAppException('ACCOUNT_DISABLED', 'حساب کاربری شما غیرفعال شده است');
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new AppException(
        'ACCOUNT_LOCKED',
        'به دلیل تلاش‌های ناموفق، حساب موقتاً قفل شده است. بعداً دوباره تلاش کنید',
        423,
        { lockedUntil: user.lockedUntil.toISOString() },
      );
    }

    const valid = await this.passwords.verify(user.passwordHash, dto.password);
    if (!valid) {
      const { loginMaxFailedAttempts, loginLockMinutes } = this.config.auth;
      const lockedUntil = await this.users.recordLoginFailure(
        user.id,
        loginMaxFailedAttempts,
        loginLockMinutes,
      );
      if (lockedUntil) {
        throw new AppException(
          'ACCOUNT_LOCKED',
          'به دلیل تلاش‌های ناموفق، حساب موقتاً قفل شده است. بعداً دوباره تلاش کنید',
          423,
          { lockedUntil: lockedUntil.toISOString() },
        );
      }
      throw new UnauthorizedAppException(
        'INVALID_CREDENTIALS',
        'نام کاربری یا رمز عبور اشتباه است',
      );
    }

    await this.users.recordLoginSuccess(user.id);
    return this.issue(user, meta);
  }

  async refresh(refreshToken: string, meta: ClientMetadata): Promise<AuthResponse> {
    const rotated = await this.tokens.rotateSession(refreshToken, meta);
    const user = await this.users.findByIdWithRoles(rotated.userId);
    if (!user || user.status === 'SUSPENDED' || user.status === 'DELETED') {
      await this.tokens.revokeFamily(rotated.familyId);
      throw new ForbiddenAppException('ACCOUNT_DISABLED', 'حساب کاربری شما غیرفعال شده است');
    }
    const accessToken = await this.tokens.signAccessToken(user.id, rotated.familyId);
    return {
      user: this.users.toAuthUser(user),
      accessToken,
      accessTokenExpiresIn: this.tokens.accessTtlSeconds,
      refreshToken: rotated.refreshToken,
    };
  }

  async logout(sessionFamilyId?: string, refreshToken?: string): Promise<void> {
    if (sessionFamilyId) await this.tokens.revokeFamily(sessionFamilyId);
    else if (refreshToken) await this.tokens.revokeByRefreshToken(refreshToken);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.tokens.revokeAllForUser(userId);
  }

  async changePassword(
    user: AuthUser,
    dto: ChangePasswordDto,
    keepFamilyId: string,
  ): Promise<void> {
    const record = await this.users.findByIdWithRoles(user.id);
    if (!record) throw new UnauthorizedAppException();
    const valid = await this.passwords.verify(record.passwordHash, dto.currentPassword);
    if (!valid) {
      throw new UnprocessableAppException('INVALID_CURRENT_PASSWORD', 'رمز عبور فعلی اشتباه است');
    }
    await this.users.updatePasswordHash(user.id, await this.passwords.hash(dto.newPassword));
    // Other devices must sign in again; the current session stays valid.
    await this.tokens.revokeAllForUser(user.id, keepFamilyId);
  }

  /** Always resolves without revealing whether the identifier exists. */
  async requestPasswordReset(identifier: string): Promise<void> {
    const user = await this.users.findCredentialsByIdentifier(identifier);
    if (!user || user.status === 'DELETED') return;

    const token = randomBytes(RESET_TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(Date.now() + this.config.auth.passwordResetTtlMinutes * MINUTE_MS);
    await this.prisma.$transaction([
      // A new request supersedes any outstanding token.
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: sha256(token), expiresAt },
      }),
    ]);
    await this.notifications.sendPasswordReset({ email: user.email, phone: user.phone }, token);
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new UnprocessableAppException(
        'RESET_TOKEN_INVALID',
        'پیوند بازیابی نامعتبر یا منقضی شده است',
      );
    }
    const passwordHash = await this.passwords.hash(password);
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
      }),
    ]);
    // A password reset invalidates every existing session.
    await this.tokens.revokeAllForUser(record.userId);
  }

  async requestVerification(user: AuthUser, dto: RequestVerificationDto): Promise<void> {
    const target = dto.channel === 'EMAIL' ? user.email : user.phone;
    if (!target) {
      throw new UnprocessableAppException(
        'VERIFICATION_TARGET_MISSING',
        dto.channel === 'EMAIL'
          ? 'ایمیلی برای حساب ثبت نشده است'
          : 'شماره موبایلی برای حساب ثبت نشده است',
      );
    }
    if (
      (dto.channel === 'EMAIL' && user.emailVerified) ||
      (dto.channel === 'PHONE' && user.phoneVerified)
    ) {
      throw new UnprocessableAppException('ALREADY_VERIFIED', 'این مورد قبلاً تأیید شده است');
    }
    const code = String(randomInt(VERIFICATION_CODE_MIN, VERIFICATION_CODE_MAX));
    const expiresAt = new Date(
      Date.now() + this.config.auth.verificationCodeTtlMinutes * MINUTE_MS,
    );
    await this.prisma.$transaction([
      this.prisma.verificationCode.updateMany({
        where: { userId: user.id, channel: dto.channel, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      this.prisma.verificationCode.create({
        data: { userId: user.id, channel: dto.channel, target, codeHash: sha256(code), expiresAt },
      }),
    ]);
    await this.notifications.sendVerificationCode(dto.channel, target, code);
  }

  async confirmVerification(user: AuthUser, dto: ConfirmVerificationDto): Promise<AuthUser> {
    const record = await this.prisma.verificationCode.findFirst({
      where: { userId: user.id, channel: dto.channel, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (
      !record ||
      record.expiresAt.getTime() <= Date.now() ||
      record.attempts >= VERIFICATION_MAX_ATTEMPTS
    ) {
      throw new UnprocessableAppException(
        'VERIFICATION_CODE_INVALID',
        'کد تأیید نامعتبر یا منقضی شده است',
      );
    }
    if (record.codeHash !== sha256(dto.code)) {
      await this.prisma.verificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnprocessableAppException('VERIFICATION_CODE_INVALID', 'کد تأیید نامعتبر است');
    }
    await this.prisma.verificationCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
    await this.users.markVerified(user.id, dto.channel);
    return this.users.findAuthUserOrThrow(user.id);
  }

  private async issue(user: UserWithRoles, meta: ClientMetadata): Promise<AuthResponse> {
    const session = await this.tokens.createSession(user.id, meta);
    const accessToken = await this.tokens.signAccessToken(user.id, session.familyId);
    this.logger.log({ message: 'session issued', userId: user.id });
    return {
      user: this.users.toAuthUser(user),
      accessToken,
      accessTokenExpiresIn: this.tokens.accessTtlSeconds,
      refreshToken: session.refreshToken,
    };
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
