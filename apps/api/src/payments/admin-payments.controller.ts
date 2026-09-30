import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  AdminPaymentDetail,
  AdminPaymentSummary,
  AuthUser,
  Paginated,
  ReconcileResult,
} from '@pe/shared';
import { AuditService } from '../audit/audit.service.js';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { Permissions } from '../rbac/permissions.js';
import { AdminPaymentsQueryDto, RefundPaymentDto } from './dto/payment.dto.js';
import { PaymentsService } from './payments.service.js';

@ApiTags('admin/payments')
@ApiBearerAuth('access-token')
@ApiCookieAuth('pe_access')
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions(Permissions.PaymentView)
  @ApiOperation({ summary: 'List payment attempts' })
  list(@Query() query: AdminPaymentsQueryDto): Promise<Paginated<AdminPaymentSummary>> {
    return this.payments.adminList(query);
  }

  @Get(':id')
  @RequirePermissions(Permissions.PaymentView)
  @ApiOperation({ summary: 'Payment attempt with its provider ledger' })
  get(@Param('id') id: string): Promise<AdminPaymentDetail> {
    return this.payments.adminGet(id);
  }

  @Post(':id/reconcile')
  @RequirePermissions(Permissions.PaymentReconcile)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Query the provider and synchronize the payment state' })
  async reconcile(
    @Param('id') id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<ReconcileResult> {
    const result = await this.payments.reconcile(id);
    await this.audit.record({
      actorId: actor.id,
      action: 'payment.reconcile',
      entityType: 'Payment',
      entityId: id,
      metadata: {
        providerStatus: result.providerStatus,
        changed: result.changed,
        status: result.payment.status,
      },
      request: req,
    });
    return result;
  }

  @Post(':id/refund')
  @RequirePermissions(Permissions.PaymentRefund)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refund/reverse a paid attempt of a cancelled or returned order' })
  async refund(
    @Param('id') id: string,
    @Body() dto: RefundPaymentDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminPaymentDetail> {
    const result = await this.payments.refund(id, dto.reason ?? null);
    await this.audit.record({
      actorId: actor.id,
      action: 'payment.refund',
      entityType: 'Payment',
      entityId: id,
      metadata: { amount: result.amount, provider: result.provider, reason: dto.reason },
      request: req,
    });
    return result;
  }
}
