import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser, Paginated } from '@pe/shared';
import { AuditService } from '../audit/audit.service.js';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { ForbiddenAppException } from '../common/errors/app.exception.js';
import { Permissions, RoleName } from '../rbac/permissions.js';
import { AdminUsersQueryDto, UpdateUserRolesDto, UpdateUserStatusDto } from './dto/users.dto.js';
import { type AdminUserSummary, UsersService } from './users.service.js';

const PRIVILEGED_ROLES = new Set<string>([RoleName.Admin, RoleName.SuperAdmin]);

@ApiTags('admin/users')
@ApiBearerAuth('access-token')
@ApiCookieAuth('pe_access')
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions(Permissions.UsersView)
  @ApiOperation({ summary: 'List users (admin)' })
  list(@Query() query: AdminUsersQueryDto): Promise<Paginated<AdminUserSummary>> {
    return this.users.adminList(query);
  }

  @Get(':id')
  @RequirePermissions(Permissions.UsersView)
  @ApiOperation({ summary: 'Get user (admin)' })
  get(@Param('id') id: string): Promise<AdminUserSummary> {
    return this.users.adminGet(id);
  }

  @Patch(':id/status')
  @RequirePermissions(Permissions.UsersManage)
  @ApiOperation({ summary: 'Change user status (admin)' })
  @ApiOkResponse()
  async setStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminUserSummary> {
    if (id === actor.id) {
      throw new ForbiddenAppException(
        'SELF_MODIFICATION',
        'نمی‌توانید وضعیت حساب خود را تغییر دهید',
      );
    }
    const target = await this.users.adminGet(id);
    this.assertCanManage(actor, target);
    const updated = await this.users.adminSetStatus(id, dto.status);
    await this.audit.record({
      actorId: actor.id,
      action: 'user.status.update',
      entityType: 'User',
      entityId: id,
      metadata: { from: target.status, to: dto.status },
      request: req,
    });
    return updated;
  }

  @Patch(':id/roles')
  @RequirePermissions(Permissions.UsersManage)
  @ApiOperation({ summary: 'Replace user roles (admin)' })
  async setRoles(
    @Param('id') id: string,
    @Body() dto: UpdateUserRolesDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminUserSummary> {
    if (id === actor.id) {
      throw new ForbiddenAppException('SELF_MODIFICATION', 'نمی‌توانید نقش‌های خود را تغییر دهید');
    }
    const target = await this.users.adminGet(id);
    this.assertCanManage(actor, target);
    const grantsPrivileged = dto.roles.some((r) => PRIVILEGED_ROLES.has(r));
    if (grantsPrivileged && !this.canManageRoles(actor)) {
      throw new ForbiddenAppException(
        'PERMISSION_DENIED',
        'اعطای نقش مدیریتی نیازمند مجوز roles.manage است',
      );
    }
    const updated = await this.users.adminSetRoles(id, dto.roles);
    await this.audit.record({
      actorId: actor.id,
      action: 'user.roles.update',
      entityType: 'User',
      entityId: id,
      metadata: { from: target.roles, to: dto.roles },
      request: req,
    });
    return updated;
  }

  private canManageRoles(actor: AuthUser): boolean {
    return (
      actor.roles.includes(RoleName.SuperAdmin) ||
      actor.permissions.includes(Permissions.RolesManage)
    );
  }

  /** Admins may not modify other privileged accounts unless they hold roles.manage. */
  private assertCanManage(actor: AuthUser, target: AdminUserSummary): void {
    const targetPrivileged = target.roles.some((r) => PRIVILEGED_ROLES.has(r));
    if (targetPrivileged && !this.canManageRoles(actor)) {
      throw new ForbiddenAppException(
        'PERMISSION_DENIED',
        'مدیریت حساب‌های مدیریتی نیازمند مجوز roles.manage است',
      );
    }
  }
}
