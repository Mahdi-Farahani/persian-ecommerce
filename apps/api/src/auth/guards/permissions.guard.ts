import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ForbiddenAppException,
  UnauthorizedAppException,
} from '../../common/errors/app.exception.js';
import type { PermissionKey, RoleNameValue } from '../../rbac/permissions.js';
import { RoleName } from '../../rbac/permissions.js';
import { REQUIRED_PERMISSIONS_KEY, REQUIRED_ROLES_KEY } from '../auth.decorators.js';
import type { AuthenticatedRequest } from '../auth.types.js';

/**
 * Enforces `@RequirePermissions()` and `@Roles()` metadata. Runs after
 * JwtAuthGuard (guards execute in registration order).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const permissions =
      this.reflector.getAllAndOverride<PermissionKey[]>(REQUIRED_PERMISSIONS_KEY, targets) ?? [];
    const roles =
      this.reflector.getAllAndOverride<RoleNameValue[]>(REQUIRED_ROLES_KEY, targets) ?? [];
    if (permissions.length === 0 && roles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user) throw new UnauthorizedAppException();

    if (roles.length > 0 && !roles.some((role) => user.roles.includes(role))) {
      throw new ForbiddenAppException();
    }

    const isSuperAdmin = user.roles.includes(RoleName.SuperAdmin);
    if (!isSuperAdmin && !permissions.every((p) => user.permissions.includes(p))) {
      throw new ForbiddenAppException('PERMISSION_DENIED', 'شما مجوز انجام این عملیات را ندارید', {
        required: permissions,
      });
    }
    return true;
  }
}
