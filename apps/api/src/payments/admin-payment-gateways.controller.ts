import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  AuthUser,
  ConnectionTestResult,
  PaymentGatewayAdminView,
  PaymentProviderName,
  TestPaymentResult,
} from '@pe/shared';
import { AuditService } from '../audit/audit.service.js';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { Permissions } from '../rbac/permissions.js';
import { UpdatePaymentGatewayDto } from './dto/payment.dto.js';
import { PaymentProviderFactory } from './payment-provider.factory.js';
import { PaymentProviderError } from './payment.errors.js';
import { providerFromSlug } from './provider-definitions.js';
import { ProviderRegistryService } from './provider-registry.service.js';

@ApiTags('admin/payment-gateways')
@ApiBearerAuth('access-token')
@ApiCookieAuth('pe_access')
@Controller('admin/payment-gateways')
export class AdminPaymentGatewaysController {
  constructor(
    private readonly registry: ProviderRegistryService,
    private readonly factory: PaymentProviderFactory,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions(Permissions.PaymentGatewayView)
  @ApiOperation({ summary: 'All gateways with masked credentials' })
  list(): Promise<PaymentGatewayAdminView[]> {
    return this.registry.listAdmin();
  }

  @Get(':provider')
  @RequirePermissions(Permissions.PaymentGatewayView)
  @ApiOperation({ summary: 'One gateway' })
  get(@Param('provider') slug: string): Promise<PaymentGatewayAdminView> {
    return this.registry.getAdmin(this.resolve(slug));
  }

  @Patch(':provider')
  @RequirePermissions(Permissions.PaymentGatewayUpdate)
  @ApiOperation({ summary: 'Update enablement, default, environment, credentials, settings' })
  async update(
    @Param('provider') slug: string,
    @Body() dto: UpdatePaymentGatewayDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<PaymentGatewayAdminView> {
    const provider = this.resolve(slug);
    const { view, changes } = await this.registry.update(provider, dto);
    if (changes.length > 0) {
      await this.audit.record({
        actorId: actor.id,
        action: 'payment_gateway.update',
        entityType: 'PaymentProviderConfig',
        entityId: provider,
        metadata: { provider, changes },
        request: req,
      });
    }
    return view;
  }

  @Post(':provider/test')
  @RequirePermissions(Permissions.PaymentGatewayTest)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test connectivity/credentials without creating a transaction' })
  async test(
    @Param('provider') slug: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<ConnectionTestResult> {
    const provider = this.resolve(slug);
    let result: { ok: boolean; message: string };
    try {
      const adapter = this.factory.create(await this.registry.contextForAdmin(provider));
      result = await adapter.testConnection();
    } catch (error) {
      result = { ok: false, message: describe(error) };
    }
    const view = await this.registry.recordTest(provider, result);
    await this.audit.record({
      actorId: actor.id,
      action: 'payment_gateway.test',
      entityType: 'PaymentProviderConfig',
      entityId: provider,
      metadata: { provider, ok: result.ok, message: result.message },
      request: req,
    });
    return {
      ok: result.ok,
      message: result.message,
      testedAt: view.lastTestedAt ?? new Date().toISOString(),
    };
  }

  @Post(':provider/test-payment')
  @RequirePermissions(Permissions.PaymentGatewayTest)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Create a minimal provider payment request (no order); callback lands on the admin page',
  })
  async testPayment(
    @Param('provider') slug: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<TestPaymentResult> {
    const provider = this.resolve(slug);
    const context = await this.registry.contextForAdmin(provider);
    const definition = this.registry.definition(provider);
    if (!definition.capabilities.includes('create') || !this.factory.supports(provider)) {
      return {
        supported: false,
        redirectUrl: null,
        authority: null,
        message: 'این درگاه قابل استفاده نیست',
      };
    }
    if (context.environment === 'PRODUCTION') {
      return {
        supported: false,
        redirectUrl: null,
        authority: null,
        message: 'پرداخت آزمایشی فقط در محیط آزمایشی انجام می‌شود تا تراکنش واقعی ایجاد نشود',
      };
    }
    const callbackUrl = new URL(context.callbackUrl);
    callbackUrl.searchParams.set('test', '1');
    let result: TestPaymentResult;
    try {
      const adapter = this.factory.create(context);
      const created = await adapter.createPayment({
        paymentId: 'test',
        requestId: `test-${Date.now()}`,
        orderId: 'test',
        orderNumber: 'TEST',
        amount: definition.minAmount,
        currency: 'IRR',
        description: 'پرداخت آزمایشی پنل مدیریت',
        customer: { mobile: actor.phone, email: actor.email, name: null },
        callbackUrl: callbackUrl.toString(),
        items: [],
      });
      result = {
        supported: true,
        redirectUrl: created.redirectUrl,
        authority: created.authority,
        message: 'درخواست پرداخت آزمایشی ایجاد شد',
      };
    } catch (error) {
      result = { supported: true, redirectUrl: null, authority: null, message: describe(error) };
    }
    await this.audit.record({
      actorId: actor.id,
      action: 'payment_gateway.test_payment',
      entityType: 'PaymentProviderConfig',
      entityId: provider,
      metadata: { provider, ok: Boolean(result.redirectUrl), message: result.message },
      request: req,
    });
    return result;
  }

  private resolve(slug: string): PaymentProviderName {
    const provider = providerFromSlug(slug);
    if (!provider) throw new NotFoundException();
    return provider;
  }
}

function describe(error: unknown): string {
  if (error instanceof PaymentProviderError) {
    return error.providerCode ? `${error.message} (کد ${error.providerCode})` : error.message;
  }
  return (error as Error).message || 'خطای ناشناخته';
}
