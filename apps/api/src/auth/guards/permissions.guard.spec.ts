import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { AuthUser } from '@pe/shared';
import { REQUIRED_PERMISSIONS_KEY, REQUIRED_ROLES_KEY } from '../auth.decorators.js';
import { PermissionsGuard } from './permissions.guard.js';

function contextFor(
  user: Partial<AuthUser> | undefined,
  metadata: Record<string, unknown>,
): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    __metadata: metadata,
  } as unknown as ExecutionContext;
}

function guardWith(metadata: Record<string, unknown>): PermissionsGuard {
  const reflector = {
    getAllAndOverride: (key: string) => metadata[key],
  } as unknown as Reflector;
  return new PermissionsGuard(reflector);
}

describe('PermissionsGuard', () => {
  it('allows routes without metadata', () => {
    expect(guardWith({}).canActivate(contextFor(undefined, {}))).toBe(true);
  });

  it('rejects anonymous users on protected routes', () => {
    const guard = guardWith({ [REQUIRED_PERMISSIONS_KEY]: ['users.view'] });
    expect(() => guard.canActivate(contextFor(undefined, {}))).toThrow(/احراز هویت/);
  });

  it('checks permissions', () => {
    const guard = guardWith({ [REQUIRED_PERMISSIONS_KEY]: ['users.view', 'users.manage'] });
    expect(
      guard.canActivate(
        contextFor({ roles: ['ADMIN'], permissions: ['users.view', 'users.manage'] }, {}),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(contextFor({ roles: ['ADMIN'], permissions: ['users.view'] }, {})),
    ).toThrow(/مجوز/);
  });

  it('lets SUPER_ADMIN bypass permission checks but not role checks', () => {
    const permissionGuard = guardWith({ [REQUIRED_PERMISSIONS_KEY]: ['anything.rare'] });
    expect(
      permissionGuard.canActivate(contextFor({ roles: ['SUPER_ADMIN'], permissions: [] }, {})),
    ).toBe(true);

    const roleGuard = guardWith({ [REQUIRED_ROLES_KEY]: ['SELLER'] });
    expect(() =>
      roleGuard.canActivate(contextFor({ roles: ['SUPER_ADMIN'], permissions: [] }, {})),
    ).toThrow();
    expect(roleGuard.canActivate(contextFor({ roles: ['SELLER'], permissions: [] }, {}))).toBe(
      true,
    );
  });
});
