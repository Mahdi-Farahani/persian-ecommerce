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
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser, Paginated } from '@pe/shared';
import { AuditService } from '../audit/audit.service.js';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { Permissions } from '../rbac/permissions.js';
import { CouponsService, type CouponView } from './coupons.service.js';
import { AdminCouponsQueryDto, CreateCouponDto, UpdateCouponDto } from './dto/coupon.dto.js';

@ApiTags('admin/coupons')
@ApiBearerAuth('access-token')
@ApiCookieAuth('pe_access')
@RequirePermissions(Permissions.DiscountsManage)
@Controller('admin/coupons')
export class AdminCouponsController {
  constructor(
    private readonly coupons: CouponsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List coupons' })
  list(@Query() query: AdminCouponsQueryDto): Promise<Paginated<CouponView>> {
    return this.coupons.adminList(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get coupon' })
  get(@Param('id') id: string): Promise<CouponView> {
    return this.coupons.adminGet(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create coupon' })
  async create(
    @Body() dto: CreateCouponDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<CouponView> {
    const coupon = await this.coupons.create(dto);
    await this.audit.record({
      actorId: actor.id,
      action: 'coupon.create',
      entityType: 'Coupon',
      entityId: coupon.id,
      metadata: { code: coupon.code },
      request: req,
    });
    return coupon;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update coupon' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<CouponView> {
    const coupon = await this.coupons.update(id, dto);
    await this.audit.record({
      actorId: actor.id,
      action: 'coupon.update',
      entityType: 'Coupon',
      entityId: id,
      metadata: { changes: dto },
      request: req,
    });
    return coupon;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete coupon' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.coupons.remove(id);
    await this.audit.record({
      actorId: actor.id,
      action: 'coupon.delete',
      entityType: 'Coupon',
      entityId: id,
      request: req,
    });
  }
}
