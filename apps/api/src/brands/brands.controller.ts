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
import type { AuthUser, BrandDetail, BrandSummary, Paginated } from '@pe/shared';
import { AuditService } from '../audit/audit.service.js';
import { CurrentUser, Public, RequirePermissions } from '../auth/auth.decorators.js';
import { PublicCache } from '../common/decorators/public-cache.decorator.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { Permissions } from '../rbac/permissions.js';
import { BrandsService } from './brands.service.js';
import { AdminBrandsQueryDto, CreateBrandDto, UpdateBrandDto } from './dto/brand.dto.js';

@ApiTags('brands')
@Public()
@PublicCache()
@Controller('brands')
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  @ApiOperation({ summary: 'List active brands' })
  list(): Promise<BrandSummary[]> {
    return this.brands.listPublic();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get brand by slug' })
  get(@Param('slug') slug: string): Promise<BrandDetail> {
    return this.brands.getPublicBySlug(slug);
  }
}

@ApiTags('admin/brands')
@ApiBearerAuth('access-token')
@ApiCookieAuth('pe_access')
@RequirePermissions(Permissions.CatalogManage)
@Controller('admin/brands')
export class AdminBrandsController {
  constructor(
    private readonly brands: BrandsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions(Permissions.CatalogView)
  @ApiOperation({ summary: 'List brands (admin)' })
  list(@Query() query: AdminBrandsQueryDto): Promise<Paginated<BrandDetail>> {
    return this.brands.adminList(query);
  }

  @Get(':id')
  @RequirePermissions(Permissions.CatalogView)
  @ApiOperation({ summary: 'Get brand (admin)' })
  get(@Param('id') id: string): Promise<BrandDetail> {
    return this.brands.adminGet(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create brand' })
  async create(
    @Body() dto: CreateBrandDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<BrandDetail> {
    const brand = await this.brands.create(dto);
    await this.audit.record({
      actorId: actor.id,
      action: 'brand.create',
      entityType: 'Brand',
      entityId: brand.id,
      metadata: { name: brand.name },
      request: req,
    });
    return brand;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update brand' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<BrandDetail> {
    const brand = await this.brands.update(id, dto);
    await this.audit.record({
      actorId: actor.id,
      action: 'brand.update',
      entityType: 'Brand',
      entityId: id,
      metadata: { changes: dto },
      request: req,
    });
    return brand;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete brand (only when unused)' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.brands.remove(id);
    await this.audit.record({
      actorId: actor.id,
      action: 'brand.delete',
      entityType: 'Brand',
      entityId: id,
      request: req,
    });
  }
}
