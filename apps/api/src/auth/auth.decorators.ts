import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { PermissionKey, RoleNameValue } from '../rbac/permissions.js';
import type { AuthenticatedRequest, AuthenticatedUser } from './auth.types.js';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const IS_OPTIONAL_AUTH_KEY = 'auth:isOptional';
export const REQUIRED_PERMISSIONS_KEY = 'auth:permissions';
export const REQUIRED_ROLES_KEY = 'auth:roles';

/** Marks a route as accessible without authentication. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Authenticates the caller when credentials are present but does not reject
 * anonymous requests (e.g. guest carts).
 */
export const OptionalAuth = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_OPTIONAL_AUTH_KEY, true);

/** Requires every listed permission (SUPER_ADMIN bypasses permission checks). */
export const RequirePermissions = (
  ...permissions: PermissionKey[]
): MethodDecorator & ClassDecorator => SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

/** Requires at least one of the listed roles. */
export const Roles = (...roles: RoleNameValue[]): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_ROLES_KEY, roles);

/** Injects the authenticated user (or `undefined` on optional-auth routes). */
export const CurrentUser = createParamDecorator(
  (property: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) return undefined;
    return property ? user[property] : user;
  },
);
