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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import type {
  AuthUser,
  InventorySnapshot,
  InventoryTransactionView,
  Paginated,
  ProductDetail,
  SellerDashboard,
  SellerOfferView,
  SellerOrderView,
  SellerProfileView,
  SettlementView,
} from '@pe/shared';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { CreateProductDto } from '../products/dto/product.dto.js';
import { Permissions } from '../rbac/permissions.js';
import {
  ApplySellerDto,
  CreateOfferDto,
  SellerAdjustStockDto,
  SellerOrdersQueryDto,
  SellerShipmentDto,
  UpdateOfferDto,
  UpdateSellerProfileDto,
} from './dto/seller.dto.js';
import { SellerCatalogService } from './seller-catalog.service.js';
import { SellerOrdersService } from './seller-orders.service.js';
import { SellersService } from './sellers.service.js';
import { SettlementsService } from './settlements.service.js';

export class SellerOffersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  search?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  @IsBoolean()
  lowStock?: boolean;
}

/**
 * Seller portal. Applying and reading one's own application need only a
 * login; everything else requires the SELLER role (granted on approval) and
 * an APPROVED seller record, which every handler resolves explicitly.
 */
@ApiTags('seller')
@ApiBearerAuth('access-token')
@ApiCookieAuth('pe_access')
@Controller('seller')
export class SellerController {
  constructor(
    private readonly sellers: SellersService,
    private readonly catalog: SellerCatalogService,
    private readonly orders: SellerOrdersService,
    private readonly settlements: SettlementsService,
  ) {}

  @Post('apply')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Apply to become a seller (one application per account)' })
  apply(@CurrentUser() user: AuthUser, @Body() dto: ApplySellerDto): Promise<SellerProfileView> {
    return this.sellers.apply(user.id, dto);
  }

  @Get('profile')
  @ApiOperation({ summary: 'My seller profile/application (null when none)' })
  profile(@CurrentUser() user: AuthUser): Promise<SellerProfileView | null> {
    return this.sellers.profileOf(user.id);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update my seller profile (rejected applications re-enter review)' })
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateSellerProfileDto,
  ): Promise<SellerProfileView> {
    return this.sellers.updateProfile(user.id, dto);
  }

  @Get('dashboard')
  @RequirePermissions(Permissions.SellerPortal)
  @ApiOperation({ summary: 'Seller analytics' })
  async dashboard(@CurrentUser() user: AuthUser): Promise<SellerDashboard> {
    const seller = await this.sellers.requireApproved(user.id);
    return this.orders.dashboard(seller);
  }

  // --- offers ---------------------------------------------------------------------

  @Get('products')
  @RequirePermissions(Permissions.SellerPortal)
  @ApiOperation({ summary: 'My offers (variants I sell)' })
  async offers(
    @CurrentUser() user: AuthUser,
    @Query() query: SellerOffersQueryDto,
  ): Promise<Paginated<SellerOfferView>> {
    const seller = await this.sellers.requireApproved(user.id);
    return this.catalog.listOffers(seller.id, query);
  }

  @Post('products')
  @RequirePermissions(Permissions.SellerPortal)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Propose a new catalogue product (created as DRAFT for admin review)' })
  async propose(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProductDto,
  ): Promise<ProductDetail> {
    const seller = await this.sellers.requireApproved(user.id);
    return this.catalog.proposeProduct(seller.id, dto);
  }

  @Post('products/:productId/offers')
  @RequirePermissions(Permissions.SellerPortal)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add my offer (price, SKU, stock) to a catalogue product' })
  async createOffer(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
    @Body() dto: CreateOfferDto,
  ): Promise<SellerOfferView> {
    const seller = await this.sellers.requireApproved(user.id);
    return this.catalog.createOffer(seller.id, productId, dto);
  }

  @Patch('offers/:variantId')
  @RequirePermissions(Permissions.SellerPortal)
  @ApiOperation({ summary: 'Update price/status of my offer' })
  async updateOffer(
    @CurrentUser() user: AuthUser,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateOfferDto,
  ): Promise<SellerOfferView> {
    const seller = await this.sellers.requireApproved(user.id);
    return this.catalog.updateOffer(seller.id, variantId, dto);
  }

  @Delete('offers/:variantId')
  @RequirePermissions(Permissions.SellerPortal)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove my offer' })
  async removeOffer(
    @CurrentUser() user: AuthUser,
    @Param('variantId') variantId: string,
  ): Promise<void> {
    const seller = await this.sellers.requireApproved(user.id);
    await this.catalog.removeOffer(seller.id, variantId);
  }

  // --- inventory ------------------------------------------------------------------

  @Get('inventory')
  @RequirePermissions(Permissions.SellerPortal)
  @ApiOperation({ summary: 'Stock of my offers (alias of products with lowStock filter)' })
  async inventory(
    @CurrentUser() user: AuthUser,
    @Query() query: SellerOffersQueryDto,
  ): Promise<Paginated<SellerOfferView>> {
    const seller = await this.sellers.requireApproved(user.id);
    return this.catalog.listOffers(seller.id, query);
  }

  @Patch('inventory/:variantId/adjust')
  @RequirePermissions(Permissions.SellerPortal)
  @ApiOperation({ summary: 'Adjust stock of my offer' })
  async adjust(
    @CurrentUser() user: AuthUser,
    @Param('variantId') variantId: string,
    @Body() dto: SellerAdjustStockDto,
  ): Promise<InventorySnapshot> {
    const seller = await this.sellers.requireApproved(user.id);
    return this.catalog.adjustStock(seller.id, variantId, dto, user.id);
  }

  @Get('inventory/:variantId/transactions')
  @RequirePermissions(Permissions.SellerPortal)
  @ApiOperation({ summary: 'Ledger of my offer' })
  async transactions(
    @CurrentUser() user: AuthUser,
    @Param('variantId') variantId: string,
  ): Promise<InventoryTransactionView[]> {
    const seller = await this.sellers.requireApproved(user.id);
    return this.catalog.transactions(seller.id, variantId);
  }

  // --- orders -----------------------------------------------------------------------

  @Get('orders')
  @RequirePermissions(Permissions.SellerPortal)
  @ApiOperation({ summary: 'Orders containing my items (my items only)' })
  async orderList(
    @CurrentUser() user: AuthUser,
    @Query() query: SellerOrdersQueryDto,
  ): Promise<Paginated<SellerOrderView>> {
    const seller = await this.sellers.requireApproved(user.id);
    return this.orders.list(seller.id, query);
  }

  @Get('orders/:id')
  @RequirePermissions(Permissions.SellerPortal)
  @ApiOperation({ summary: 'One order, restricted to my items' })
  async order(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<SellerOrderView> {
    const seller = await this.sellers.requireApproved(user.id);
    return this.orders.get(seller.id, id);
  }

  @Post('orders/:id/shipments')
  @RequirePermissions(Permissions.SellerPortal)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Dispatch my items (order ships once every seller has dispatched)' })
  async ship(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SellerShipmentDto,
  ): Promise<SellerOrderView> {
    const seller = await this.sellers.requireApproved(user.id);
    return this.orders.ship(seller.id, id, dto, user.id);
  }

  // --- settlements ----------------------------------------------------------------

  @Get('settlements')
  @RequirePermissions(Permissions.SellerPortal)
  @ApiOperation({ summary: 'My settlement batches' })
  async settlementList(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<SettlementView>> {
    const seller = await this.sellers.requireApproved(user.id);
    return this.settlements.listForSeller(seller.id, query.page, query.limit);
  }
}
