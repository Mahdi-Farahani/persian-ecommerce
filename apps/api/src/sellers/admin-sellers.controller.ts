import {
  Body,
  Controller,
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
import type {
  AdminOrderSummary,
  AdminSellerView,
  AdminSettlementView,
  AuthUser,
  Paginated,
  SellerOfferView,
  SellerPublicView,
} from '@pe/shared';
import { AuditService } from '../audit/audit.service.js';
import { NotFoundAppException } from '../common/errors/app.exception.js';
import { CurrentUser, Public, RequirePermissions } from '../auth/auth.decorators.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { AdminOrdersQueryDto } from '../orders/dto/order.dto.js';
import { OrdersService } from '../orders/orders.service.js';
import { Permissions } from '../rbac/permissions.js';
import {
  AdminSellersQueryDto,
  CreateSettlementDto,
  SettlementsQueryDto,
  UpdateSellerCommissionDto,
  UpdateSellerStatusDto,
  UpdateSettlementDto,
} from './dto/seller.dto.js';
import { SellerCatalogService } from './seller-catalog.service.js';
import { SellersService } from './sellers.service.js';
import { toSellerPublic } from './sellers.mapper.js';
import { SettlementsService } from './settlements.service.js';

@ApiTags('sellers')
@Controller('sellers')
export class PublicSellersController {
  constructor(private readonly sellers: SellersService) {}

  @Get(':slug')
  @Public()
  @ApiOperation({ summary: 'Public storefront identity of an approved seller' })
  async get(
    @Param('slug') slug: string,
  ): Promise<SellerPublicView & { description: string | null }> {
    const seller = await this.sellers.findPublicBySlug(slug);
    if (!seller) throw new NotFoundAppException('SELLER_NOT_FOUND', 'فروشنده پیدا نشد');
    return { ...toSellerPublic(seller), description: seller.description };
  }
}

@ApiTags('admin/sellers')
@ApiBearerAuth('access-token')
@ApiCookieAuth('pe_access')
@Controller('admin/sellers')
export class AdminSellersController {
  constructor(
    private readonly sellers: SellersService,
    private readonly catalog: SellerCatalogService,
    private readonly orders: OrdersService,
    private readonly settlements: SettlementsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions(Permissions.SellersView)
  @ApiOperation({ summary: 'Sellers and applications (pending first)' })
  list(@Query() query: AdminSellersQueryDto): Promise<Paginated<AdminSellerView>> {
    return this.sellers.adminList(query);
  }

  @Get(':id')
  @RequirePermissions(Permissions.SellersView)
  @ApiOperation({ summary: 'Seller detail' })
  get(@Param('id') id: string): Promise<AdminSellerView> {
    return this.sellers.adminGet(id);
  }

  @Patch(':id/status')
  @RequirePermissions(Permissions.SellersManage)
  @ApiOperation({ summary: 'Approve, suspend or reject (audited; toggles the SELLER role)' })
  async setStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSellerStatusDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminSellerView> {
    const seller = await this.sellers.adminSetStatus(id, dto);
    await this.audit.record({
      actorId: actor.id,
      action: `seller.${dto.status.toLowerCase()}`,
      entityType: 'Seller',
      entityId: id,
      metadata: { status: dto.status, reason: dto.reason },
      request: req,
    });
    return seller;
  }

  @Patch(':id/commission')
  @RequirePermissions(Permissions.SellersManage)
  @ApiOperation({ summary: 'Set the platform commission (basis points, audited)' })
  async setCommission(
    @Param('id') id: string,
    @Body() dto: UpdateSellerCommissionDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminSellerView> {
    const seller = await this.sellers.adminSetCommission(id, dto);
    await this.audit.record({
      actorId: actor.id,
      action: 'seller.commission.update',
      entityType: 'Seller',
      entityId: id,
      metadata: { commissionBps: dto.commissionBps },
      request: req,
    });
    return seller;
  }

  @Get(':id/products')
  @RequirePermissions(Permissions.SellersView)
  @ApiOperation({ summary: 'Offers of a seller' })
  products(
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<SellerOfferView>> {
    return this.catalog.listOffers(id, query);
  }

  @Get(':id/orders')
  @RequirePermissions(Permissions.SellersView)
  @ApiOperation({ summary: 'Orders containing items of a seller' })
  orderList(
    @Param('id') id: string,
    @Query() query: AdminOrdersQueryDto,
  ): Promise<Paginated<AdminOrderSummary>> {
    return this.orders.adminList(query, { sellerId: id });
  }

  @Post(':id/settlements')
  @RequirePermissions(Permissions.SellersManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a settlement batch from delivered, unsettled items' })
  async createSettlement(
    @Param('id') id: string,
    @Body() dto: CreateSettlementDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminSettlementView> {
    const settlement = await this.settlements.create(id, dto, actor.id);
    await this.audit.record({
      actorId: actor.id,
      action: 'settlement.create',
      entityType: 'Settlement',
      entityId: settlement.id,
      metadata: { sellerId: id, netAmount: settlement.netAmount, itemCount: settlement.itemCount },
      request: req,
    });
    return settlement;
  }
}

@ApiTags('admin/settlements')
@ApiBearerAuth('access-token')
@ApiCookieAuth('pe_access')
@Controller('admin/settlements')
export class AdminSettlementsController {
  constructor(
    private readonly settlements: SettlementsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions(Permissions.SellersView)
  @ApiOperation({ summary: 'Settlement batches' })
  list(@Query() query: SettlementsQueryDto): Promise<Paginated<AdminSettlementView>> {
    return this.settlements.adminList(query);
  }

  @Get(':id')
  @RequirePermissions(Permissions.SellersView)
  @ApiOperation({ summary: 'Settlement detail' })
  get(@Param('id') id: string): Promise<AdminSettlementView> {
    return this.settlements.adminGet(id);
  }

  @Patch(':id')
  @RequirePermissions(Permissions.SellersManage)
  @ApiOperation({ summary: 'Mark paid (with reference) or cancel (releases items)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSettlementDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminSettlementView> {
    const settlement = await this.settlements.update(id, dto);
    await this.audit.record({
      actorId: actor.id,
      action: `settlement.${dto.status.toLowerCase()}`,
      entityType: 'Settlement',
      entityId: id,
      metadata: { paymentReference: dto.paymentReference, note: dto.note },
      request: req,
    });
    return settlement;
  }
}
