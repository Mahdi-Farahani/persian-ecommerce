import {
  All,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser, CreatePaymentResponse, PaymentProviderInfo, PaymentView } from '@pe/shared';
import type { Request, Response } from 'express';
import { CurrentUser, Public } from '../auth/auth.decorators.js';
import { AppConfigService } from '../config/app-config.service.js';
import { CreatePaymentDto } from './dto/payment.dto.js';
import { renderMockGatewayPage } from './mock-gateway.page.js';
import { MOCK_AUTHORITY_PREFIX } from './providers/mock.provider.js';
import { PaymentsService } from './payments.service.js';
import { providerFromSlug } from './provider-definitions.js';
import { ProviderRegistryService } from './provider-registry.service.js';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly registry: ProviderRegistryService,
    private readonly config: AppConfigService,
  ) {}

  @Get('providers')
  @Public()
  @ApiOperation({ summary: 'Payment gateways available at checkout (default first)' })
  providers(): Promise<PaymentProviderInfo[]> {
    return this.payments.listProviders();
  }

  @Post()
  @ApiBearerAuth('access-token')
  @ApiCookieAuth('pe_access')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create (or resume) a payment attempt for my unpaid order' })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePaymentDto,
  ): Promise<CreatePaymentResponse> {
    return this.payments.create(user.id, { orderId: dto.orderId, provider: dto.provider });
  }

  /**
   * Provider callbacks. Registered with providers as
   * `/api/v1/payments/<slug>/callback`; accepts GET (ZarinPal) and POST
   * (DigiPay) and always answers with a redirect to the storefront result page.
   */
  @All(':slug/callback')
  @Public()
  @ApiOperation({ summary: 'Gateway callback (untrusted); verifies server-side and redirects' })
  async callback(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const provider = providerFromSlug(slug);
    if (!provider || (req.method !== 'GET' && req.method !== 'POST')) {
      throw new NotFoundException();
    }
    const result = await this.payments.handleCallback(provider, {
      method: req.method,
      query: req.query ?? {},
      body: (req.body ?? {}) as Record<string, unknown>,
    });
    res.redirect(HttpStatus.SEE_OTHER, result.redirectUrl);
  }

  /** Development-only stand-in for a real gateway page. */
  @Get('mock/gateway')
  @Public()
  @ApiExcludeEndpoint()
  mockGateway(
    @Query('authority') authority: string | undefined,
    @Query('amount') amount: string | undefined,
    @Query('auto') auto: string | undefined,
    @Res() res: Response,
  ): void {
    if (!this.config.payments.mockEnabled) throw new NotFoundException();
    if (!authority || !authority.startsWith(MOCK_AUTHORITY_PREFIX) || !/^\d+$/.test(amount ?? '')) {
      throw new NotFoundException();
    }
    const callbackUrl = this.registry.callbackUrlFor('MOCK');
    if (auto === 'success' || auto === 'failure') {
      const url = new URL(callbackUrl);
      url.searchParams.set('authority', authority);
      url.searchParams.set('status', auto === 'success' ? 'OK' : 'FAIL');
      res.redirect(HttpStatus.SEE_OTHER, url.toString());
      return;
    }
    res
      .type('html')
      .send(renderMockGatewayPage({ authority, amount: Number(amount), callbackUrl }));
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @ApiCookieAuth('pe_access')
  @ApiOperation({ summary: 'My payment attempt (result pages poll this)' })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<PaymentView> {
    return this.payments.getForUser(user.id, id);
  }

  @Get(':id/status')
  @ApiBearerAuth('access-token')
  @ApiCookieAuth('pe_access')
  @ApiOperation({ summary: 'Status only' })
  async status(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<Pick<PaymentView, 'id' | 'status' | 'orderId' | 'errorCode'>> {
    const view = await this.payments.getForUser(user.id, id);
    return { id: view.id, status: view.status, orderId: view.orderId, errorCode: view.errorCode };
  }

  @Post(':id/verify')
  @ApiBearerAuth('access-token')
  @ApiCookieAuth('pe_access')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Re-verify with the provider after a lost callback' })
  verify(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<PaymentView> {
    return this.payments.verifyForUser(user.id, id);
  }
}
