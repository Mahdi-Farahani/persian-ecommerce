/**
 * Authentication contracts shared between the API and the web app.
 */

export const RoleNames = ['CUSTOMER', 'SELLER', 'ADMIN', 'SUPER_ADMIN'] as const;
export type RoleName = (typeof RoleNames)[number];

export const UserStatuses = ['ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION', 'DELETED'] as const;
export type UserStatus = (typeof UserStatuses)[number];

/** The authenticated principal as returned by `GET /auth/me`. */
export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  roles: RoleName[];
  permissions: string[];
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: AuthUser;
}

export function hasRole(user: Pick<AuthUser, 'roles'> | null | undefined, role: RoleName): boolean {
  return Boolean(user?.roles.includes(role));
}

export function hasPermission(
  user: Pick<AuthUser, 'permissions' | 'roles'> | null | undefined,
  permission: string,
): boolean {
  if (!user) return false;
  return user.roles.includes('SUPER_ADMIN') || user.permissions.includes(permission);
}

export function displayName(
  user: Pick<AuthUser, 'firstName' | 'lastName' | 'email' | 'phone'>,
): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || user.phone || '';
}

/** Password policy shared by the register/reset forms and the API. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_POLICY_REGEX = /^(?=.*\p{L})(?=.*\d).+$/u;

export function isStrongPassword(value: string): boolean {
  return (
    value.length >= PASSWORD_MIN_LENGTH &&
    value.length <= PASSWORD_MAX_LENGTH &&
    PASSWORD_POLICY_REGEX.test(value)
  );
}
