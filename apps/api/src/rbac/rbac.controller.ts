import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/auth.decorators.js';
import { Permissions } from './permissions.js';
import { RbacService, type PermissionSummary, type RoleSummary } from './rbac.service.js';

@ApiTags('admin/rbac')
@ApiBearerAuth('access-token')
@ApiCookieAuth('pe_access')
@Controller('admin')
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  @Get('roles')
  @RequirePermissions(Permissions.UsersView)
  @ApiOperation({ summary: 'List roles with their permissions' })
  roles(): Promise<RoleSummary[]> {
    return this.rbac.listRoles();
  }

  @Get('permissions')
  @RequirePermissions(Permissions.UsersView)
  @ApiOperation({ summary: 'List all permissions' })
  permissions(): Promise<PermissionSummary[]> {
    return this.rbac.listPermissions();
  }
}
