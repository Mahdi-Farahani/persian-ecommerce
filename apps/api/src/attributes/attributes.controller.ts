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
import type { AttributeSummary, AuthUser } from '@pe/shared';
import { AuditService } from '../audit/audit.service.js';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { Permissions } from '../rbac/permissions.js';
import { AttributesService } from './attributes.service.js';
import { CreateAttributeDto, UpdateAttributeDto } from './dto/attribute.dto.js';

@ApiTags('admin/attributes')
@ApiBearerAuth('access-token')
@ApiCookieAuth('pe_access')
@RequirePermissions(Permissions.CatalogManage)
@Controller('admin/attributes')
export class AdminAttributesController {
  constructor(
    private readonly attributes: AttributesService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions(Permissions.CatalogView)
  @ApiOperation({ summary: 'List attributes with values' })
  list(): Promise<AttributeSummary[]> {
    return this.attributes.list();
  }

  @Get(':id')
  @RequirePermissions(Permissions.CatalogView)
  @ApiOperation({ summary: 'Get attribute' })
  get(@Param('id') id: string): Promise<AttributeSummary> {
    return this.attributes.get(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create attribute (with values)' })
  async create(
    @Body() dto: CreateAttributeDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<AttributeSummary> {
    const attribute = await this.attributes.create(dto);
    await this.audit.record({
      actorId: actor.id,
      action: 'attribute.create',
      entityType: 'Attribute',
      entityId: attribute.id,
      metadata: { name: attribute.name },
      request: req,
    });
    return attribute;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update attribute; `values` replaces the value list' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAttributeDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<AttributeSummary> {
    const attribute = await this.attributes.update(id, dto);
    await this.audit.record({
      actorId: actor.id,
      action: 'attribute.update',
      entityType: 'Attribute',
      entityId: id,
      metadata: { changes: dto },
      request: req,
    });
    return attribute;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete unused attribute' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.attributes.remove(id);
    await this.audit.record({
      actorId: actor.id,
      action: 'attribute.delete',
      entityType: 'Attribute',
      entityId: id,
      request: req,
    });
  }
}
