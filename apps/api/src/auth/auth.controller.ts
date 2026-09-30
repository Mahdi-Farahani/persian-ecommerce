import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthResponse, AuthUser } from '@pe/shared';
import type { Request, Response } from 'express';
import { UnauthorizedAppException } from '../common/errors/app.exception.js';
import { readCartToken } from '../cart/cart.cookies.js';
import { CartService } from '../cart/cart.service.js';
import { AppConfigService } from '../config/app-config.service.js';
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from './auth.cookies.js';
import { CurrentUser, Public } from './auth.decorators.js';
import { AuthService } from './auth.service.js';
import { type AuthenticatedRequest, clientMetadata } from './auth.types.js';
import {
  ChangePasswordDto,
  ConfirmVerificationDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  RequestVerificationDto,
  ResetPasswordDto,
} from './dto/auth.dto.js';
import { AuthResponseDto, AuthUserDto, MessageResponseDto } from './dto/auth.response.js';

const ONE_MINUTE = 60_000;
const STRICT_LIMIT = { default: { limit: 10, ttl: ONE_MINUTE } };
const VERY_STRICT_LIMIT = { default: { limit: 5, ttl: ONE_MINUTE } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfigService,
    private readonly cart: CartService,
  ) {}

  @Public()
  @Throttle(STRICT_LIMIT)
  @Post('register')
  @ApiOperation({ summary: 'Create a customer account' })
  @ApiCreatedResponse({ type: AuthResponseDto })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const result = await this.auth.register(dto, clientMetadata(req));
    setAuthCookies(res, this.config.auth, result);
    await this.mergeGuestCart(req, result.user.id);
    return result;
  }

  @Public()
  @Throttle(STRICT_LIMIT)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email/phone and password' })
  @ApiOkResponse({ type: AuthResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const result = await this.auth.login(dto, clientMetadata(req));
    setAuthCookies(res, this.config.auth, result);
    await this.mergeGuestCart(req, result.user.id);
    return result;
  }

  @Public()
  @Throttle(STRICT_LIMIT)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the refresh token and issue a new access token' })
  @ApiOkResponse({ type: AuthResponseDto })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const token = dto.refreshToken ?? this.refreshCookie(req);
    if (!token) {
      throw new UnauthorizedAppException('REFRESH_TOKEN_MISSING', 'نشست یافت نشد');
    }
    try {
      const result = await this.auth.refresh(token, clientMetadata(req));
      setAuthCookies(res, this.config.auth, result);
      return result;
    } catch (error) {
      clearAuthCookies(res, this.config.auth);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the current session and clear cookies' })
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(req.auth?.sessionFamilyId, dto.refreshToken ?? this.refreshCookie(req));
    clearAuthCookies(res, this.config.auth);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiCookieAuth('pe_access')
  @ApiOperation({ summary: 'Revoke every session of the current user' })
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logoutAll(user.id);
    clearAuthCookies(res, this.config.auth);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiCookieAuth('pe_access')
  @ApiOperation({ summary: 'Current authenticated user' })
  @ApiOkResponse({ type: AuthUserDto })
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiCookieAuth('pe_access')
  @ApiOperation({ summary: 'Change password (revokes other sessions)' })
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.auth.changePassword(user, dto, req.auth?.sessionFamilyId ?? '');
  }

  @Public()
  @Throttle(VERY_STRICT_LIMIT)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset link (always succeeds)' })
  @ApiOkResponse({ type: MessageResponseDto })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<MessageResponseDto> {
    await this.auth.requestPasswordReset(dto.identifier);
    return { message: 'اگر حسابی با این مشخصات وجود داشته باشد، پیوند بازیابی ارسال شد' };
  }

  @Public()
  @Throttle(VERY_STRICT_LIMIT)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a new password using a reset token' })
  @ApiOkResponse({ type: MessageResponseDto })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<MessageResponseDto> {
    await this.auth.resetPassword(dto.token, dto.password);
    return { message: 'رمز عبور با موفقیت تغییر کرد' };
  }

  @Throttle(VERY_STRICT_LIMIT)
  @Post('verification/request')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiCookieAuth('pe_access')
  @ApiOperation({ summary: 'Send an email/phone verification code' })
  @ApiOkResponse({ type: MessageResponseDto })
  async requestVerification(
    @CurrentUser() user: AuthUser,
    @Body() dto: RequestVerificationDto,
  ): Promise<MessageResponseDto> {
    await this.auth.requestVerification(user, dto);
    return { message: 'کد تأیید ارسال شد' };
  }

  @Throttle(STRICT_LIMIT)
  @Post('verification/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiCookieAuth('pe_access')
  @ApiOperation({ summary: 'Confirm an email/phone verification code' })
  @ApiOkResponse({ type: AuthUserDto })
  confirmVerification(
    @CurrentUser() user: AuthUser,
    @Body() dto: ConfirmVerificationDto,
  ): Promise<AuthUser> {
    return this.auth.confirmVerification(user, dto);
  }

  /** A guest cart identified by the `pe_cart` cookie follows the user into their account. */
  private async mergeGuestCart(req: Request, userId: string): Promise<void> {
    const token = readCartToken(req);
    if (token) await this.cart.mergeGuestCart(userId, token);
  }

  private refreshCookie(req: Request): string | undefined {
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    return cookies?.[REFRESH_COOKIE];
  }
}
