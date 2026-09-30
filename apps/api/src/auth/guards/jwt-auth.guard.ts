import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ForbiddenAppException,
  UnauthorizedAppException,
} from '../../common/errors/app.exception.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { UsersService } from '../../users/users.service.js';
import { ACCESS_COOKIE } from '../auth.cookies.js';
import { IS_OPTIONAL_AUTH_KEY, IS_PUBLIC_KEY } from '../auth.decorators.js';
import type { AuthenticatedRequest } from '../auth.types.js';
import { TokenService } from '../token.service.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_HEADER = 'x-requested-with';

/**
 * Global authentication guard.
 *
 * - Routes are protected by default; `@Public()` opts out, `@OptionalAuth()`
 *   attaches the user when possible but never rejects.
 * - Credentials: `Authorization: Bearer <jwt>` or the httpOnly access cookie.
 * - Cookie-authenticated state-changing requests must carry the
 *   `X-Requested-With` header (or an allowed `Origin`) as CSRF protection:
 *   browsers only send custom headers after a CORS preflight, which is
 *   restricted to the configured origins.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
    private readonly config: AppConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets) ?? false;
    const isOptional =
      this.reflector.getAllAndOverride<boolean>(IS_OPTIONAL_AUTH_KEY, targets) ?? false;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const credential = this.extractCredential(request);
    if (!credential) {
      if (isPublic || isOptional) return true;
      throw new UnauthorizedAppException();
    }

    const payload = await this.tokens.verifyAccessToken(credential.token);
    if (!payload) {
      if (isPublic || isOptional) return true;
      throw new UnauthorizedAppException('TOKEN_INVALID', 'توکن نامعتبر یا منقضی شده است');
    }

    const [user, familyActive] = await Promise.all([
      this.users.findAuthUser(payload.sub),
      this.tokens.isFamilyActive(payload.sid),
    ]);
    if (!user || !familyActive) {
      if (isPublic || isOptional) return true;
      throw new UnauthorizedAppException('SESSION_REVOKED', 'نشست شما به پایان رسیده است');
    }
    if (user.status === 'SUSPENDED' || user.status === 'DELETED') {
      throw new ForbiddenAppException('ACCOUNT_DISABLED', 'حساب کاربری شما غیرفعال شده است');
    }

    if (credential.viaCookie && !SAFE_METHODS.has(request.method)) {
      this.assertCsrfProtection(request);
    }

    request.user = user;
    request.auth = { sessionFamilyId: payload.sid, viaCookie: credential.viaCookie };
    return true;
  }

  private extractCredential(
    request: AuthenticatedRequest,
  ): { token: string; viaCookie: boolean } | null {
    const header = request.header('authorization');
    if (header) {
      const [scheme, token] = header.split(' ');
      if (scheme?.toLowerCase() === 'bearer' && token) {
        return { token, viaCookie: false };
      }
    }
    const cookies = request.cookies as Record<string, string | undefined> | undefined;
    const cookieToken = cookies?.[ACCESS_COOKIE];
    if (cookieToken) return { token: cookieToken, viaCookie: true };
    return null;
  }

  private assertCsrfProtection(request: AuthenticatedRequest): void {
    if (request.header(CSRF_HEADER)) return;
    const origin = request.header('origin');
    if (origin && this.config.corsOrigins.includes(origin)) return;
    throw new ForbiddenAppException(
      'CSRF_CHECK_FAILED',
      'درخواست به دلایل امنیتی رد شد (هدر X-Requested-With الزامی است)',
    );
  }
}
