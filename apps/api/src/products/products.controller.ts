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
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser, Paginated, ProductCard, ProductDetail } from '@pe/shared';
import { AuditService } from '../audit/audit.service.js';
import { CurrentUser, Public, RequirePermissions } from '../auth/auth.decorators.js';
import { PublicCache } from '../common/decorators/public-cache.decorator.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { Permissions } from '../rbac/permissions.js';
import {
  AdminProductsQueryDto,
  CreateProductDto,
  CreateVariantDto,
  ProductImageInputDto,
  ProductListQueryDto,
  ReorderImagesDto,
  UpdateProductDto,
  UpdateProductImageDto,
  UpdateProductStatusDto,
  UpdateVariantDto,
} from './dto/product.dto.js';
import { ProductsAdminService } from './products-admin.service.js';
import { ProductsService } from './products.service.js';

@ApiTags('products')
@Public()
@PublicCache()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List products with filters, sorting and pagination' })
  list(@Query() query: ProductListQueryDto): Promise<Paginated<ProductCard>> {
    return this.products.list(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Product detail by slug' })
  get(@Param('slug') slug: string): Promise<ProductDetail> {
    return this.products.getBySlug(slug);
  }
}

@ApiTags('admin/products')
@ApiBearerAuth('access-token')
@ApiCookieAuth('pe_access')
@RequirePermissions(Permissions.CatalogManage)
@Controller('admin')
export class AdminProductsController {
  constructor(
    private readonly products: ProductsAdminService,
    private readonly audit: AuditService,
  ) {}

  @Get('products')
  @RequirePermissions(Permissions.CatalogView)
  @ApiOperation({ summary: 'List products (admin, all statuses)' })
  list(@Query() query: AdminProductsQueryDto): Promise<Paginated<ProductCard>> {
    return this.products.list(query);
  }

  @Get('products/:id')
  @RequirePermissions(Permissions.CatalogView)
  @ApiOperation({ summary: 'Product detail (admin, includes inactive variants)' })
  get(@Param('id') id: string): Promise<ProductDetail> {
    return this.products.get(id);
  }

  @Post('products')
  @ApiOperation({ summary: 'Create product with variants' })
  async create(
    @Body() dto: CreateProductDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<ProductDetail> {
    const product = await this.products.create(dto);
    await this.audit.record({
      actorId: actor.id,
      action: 'product.create',
      entityType: 'Product',
      entityId: product.id,
      metadata: { title: product.title },
      request: req,
    });
    return product;
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Update product fields, attributes and specifications' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<ProductDetail> {
    const product = await this.products.update(id, dto);
    await this.audit.record({
      actorId: actor.id,
      action: 'product.update',
      entityType: 'Product',
      entityId: id,
      metadata: { changes: Object.keys(dto) },
      request: req,
    });
    return product;
  }

  @Patch('products/:id/status')
  @ApiOperation({ summary: 'Change product lifecycle status' })
  async setStatus(
    @Param('id') id: string,
    @Body() dto: UpdateProductStatusDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<ProductDetail> {
    const product = await this.products.setStatus(id, dto.status);
    await this.audit.record({
      actorId: actor.id,
      action: 'product.status.update',
      entityType: 'Product',
      entityId: id,
      metadata: { to: dto.status },
      request: req,
    });
    return product;
  }

  @Delete('products/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete product' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.products.remove(id);
    await this.audit.record({
      actorId: actor.id,
      action: 'product.delete',
      entityType: 'Product',
      entityId: id,
      request: req,
    });
  }

  // --- variants --------------------------------------------------------------

  @Post('products/:id/variants')
  @ApiOperation({ summary: 'Add variant' })
  async addVariant(
    @Param('id') id: string,
    @Body() dto: CreateVariantDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<ProductDetail> {
    const product = await this.products.addVariant(id, dto);
    await this.audit.record({
      actorId: actor.id,
      action: 'variant.create',
      entityType: 'Product',
      entityId: id,
      metadata: { sku: dto.sku },
      request: req,
    });
    return product;
  }

  @Patch('variants/:variantId')
  @ApiOperation({ summary: 'Update variant (price, status, attributes, …)' })
  async updateVariant(
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<ProductDetail> {
    const product = await this.products.updateVariant(variantId, dto);
    await this.audit.record({
      actorId: actor.id,
      action: 'variant.update',
      entityType: 'ProductVariant',
      entityId: variantId,
      metadata: { changes: dto },
      request: req,
    });
    return product;
  }

  @Delete('variants/:variantId')
  @ApiOperation({ summary: 'Delete variant (product keeps at least one)' })
  async removeVariant(
    @Param('variantId') variantId: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<ProductDetail> {
    const product = await this.products.removeVariant(variantId);
    await this.audit.record({
      actorId: actor.id,
      action: 'variant.delete',
      entityType: 'ProductVariant',
      entityId: variantId,
      request: req,
    });
    return product;
  }

  // --- images ----------------------------------------------------------------

  @Post('products/:id/images')
  @ApiOperation({ summary: 'Attach an uploaded image to the product' })
  addImage(@Param('id') id: string, @Body() dto: ProductImageInputDto): Promise<ProductDetail> {
    return this.products.addImage(id, dto);
  }

  @Put('products/:id/images/order')
  @ApiOperation({ summary: 'Reorder product images' })
  reorderImages(@Param('id') id: string, @Body() dto: ReorderImagesDto): Promise<ProductDetail> {
    return this.products.reorderImages(id, dto.imageIds);
  }

  @Patch('product-images/:imageId')
  @ApiOperation({ summary: 'Update image metadata' })
  updateImage(
    @Param('imageId') imageId: string,
    @Body() dto: UpdateProductImageDto,
  ): Promise<ProductDetail> {
    return this.products.updateImage(imageId, dto);
  }

  @Delete('product-images/:imageId')
  @ApiOperation({ summary: 'Remove image from product' })
  removeImage(@Param('imageId') imageId: string): Promise<ProductDetail> {
    return this.products.removeImage(imageId);
  }
}
