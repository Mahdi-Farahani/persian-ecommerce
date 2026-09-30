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
import type { AuthUser, CategoryDetail, CategoryNode } from '@pe/shared';
import { AuditService } from '../audit/audit.service.js';
import { CurrentUser, Public, RequirePermissions } from '../auth/auth.decorators.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { Permissions } from '../rbac/permissions.js';
import { type AdminCategory, CategoriesService } from './categories.service.js';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';

@ApiTags('categories')
@Public()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Category tree (active categories)' })
  tree(): Promise<CategoryNode[]> {
    return this.categories.tree();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Category by slug with breadcrumb, children and filterable attributes' })
  get(@Param('slug') slug: string): Promise<CategoryDetail> {
    return this.categories.getPublicBySlug(slug);
  }
}

@ApiTags('admin/categories')
@ApiBearerAuth('access-token')
@ApiCookieAuth('pe_access')
@RequirePermissions(Permissions.CatalogManage)
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(
    private readonly categories: CategoriesService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions(Permissions.CatalogView)
  @ApiOperation({ summary: 'Flat list of all categories (admin)' })
  list(): Promise<AdminCategory[]> {
    return this.categories.adminList();
  }

  @Get('tree')
  @RequirePermissions(Permissions.CatalogView)
  @ApiOperation({ summary: 'Category tree including inactive (admin)' })
  tree(): Promise<CategoryNode[]> {
    return this.categories.tree(true);
  }

  @Get(':id')
  @RequirePermissions(Permissions.CatalogView)
  @ApiOperation({ summary: 'Get category (admin)' })
  get(@Param('id') id: string): Promise<AdminCategory> {
    return this.categories.adminGet(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create category' })
  async create(
    @Body() dto: CreateCategoryDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminCategory> {
    const category = await this.categories.create(dto);
    await this.audit.record({
      actorId: actor.id,
      action: 'category.create',
      entityType: 'Category',
      entityId: category.id,
      metadata: { name: category.name },
      request: req,
    });
    return category;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update category (supports re-parenting)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminCategory> {
    const category = await this.categories.update(id, dto);
    await this.audit.record({
      actorId: actor.id,
      action: 'category.update',
      entityType: 'Category',
      entityId: id,
      metadata: { changes: dto },
      request: req,
    });
    return category;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an empty category' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.categories.remove(id);
    await this.audit.record({
      actorId: actor.id,
      action: 'category.delete',
      entityType: 'Category',
      entityId: id,
      request: req,
    });
  }
}
