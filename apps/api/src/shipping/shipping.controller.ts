import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@pe/shared';
import { AuditService } from '../audit/audit.service.js';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { Permissions } from '../rbac/permissions.js';
import { CreateShippingMethodDto, UpdateShippingMethodDto } from './dto/shipping.dto.js';
import { type AdminShippingMethodView, ShippingService } from './shipping.service.js';

@ApiTags('admin/shipping')
@ApiBearerAuth('access-token')
@ApiCookieAuth('pe_access')
@RequirePermissions(Permissions.SettingsManage)
@Controller('admin/shipping-methods')
export class AdminShippingController {
  constructor(
    private readonly shipping: ShippingService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions(Permissions.OrdersView)
  @ApiOperation({ summary: 'List shipping methods (admin)' })
  list(): Promise<AdminShippingMethodView[]> {
    return this.shipping.adminList();
  }

  @Post()
  @ApiOperation({ summary: 'Create shipping method' })
  async create(
    @Body() dto: CreateShippingMethodDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminShippingMethodView> {
    const method = await this.shipping.create(dto);
    await this.audit.record({
      actorId: actor.id,
      action: 'shipping_method.create',
      entityType: 'ShippingMethod',
      entityId: method.id,
      metadata: { code: method.code },
      request: req,
    });
    return method;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update shipping method' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateShippingMethodDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminShippingMethodView> {
    const method = await this.shipping.update(id, dto);
    await this.audit.record({
      actorId: actor.id,
      action: 'shipping_method.update',
      entityType: 'ShippingMethod',
      entityId: id,
      metadata: { changes: dto },
      request: req,
    });
    return method;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete shipping method' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.shipping.remove(id);
    await this.audit.record({
      actorId: actor.id,
      action: 'shipping_method.delete',
      entityType: 'ShippingMethod',
      entityId: id,
      request: req,
    });
  }
}
