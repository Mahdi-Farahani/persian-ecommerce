import type { AuthUser } from '@pe/shared';
import type { Request } from 'express';

/** Principal attached to authenticated requests. */
export type AuthenticatedUser = AuthUser;

export interface AccessTokenPayload {
  /** user id */
  sub: string;
  /** refresh-session family id; revoking the family invalidates the token */
  sid: string;
  type: 'access';
  iat?: number;
  exp?: number;
}

export interface AuthContext {
  sessionFamilyId: string;
  /** true when the credential came from the httpOnly cookie */
  viaCookie: boolean;
}

export interface AuthenticatedRequest extends Request {
  id?: string;
  user?: AuthenticatedUser;
  auth?: AuthContext;
}

export interface ClientMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export function clientMetadata(request: Request): ClientMetadata {
  const userAgent = request.header('user-agent');
  return {
    ipAddress: request.ip,
    userAgent: userAgent ? userAgent.slice(0, 255) : undefined,
  };
}
