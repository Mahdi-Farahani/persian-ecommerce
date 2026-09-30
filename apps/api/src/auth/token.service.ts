import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../config/app-config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UnauthorizedAppException } from '../common/errors/app.exception.js';
import type { AccessTokenPayload, ClientMetadata } from './auth.types.js';

export interface IssuedSession {
  familyId: string;
  refreshToken: string;
  expiresAt: Date;
}

const DAY_MS = 86_400_000;
const REFRESH_TOKEN_BYTES = 48;
/** How long a rotated refresh token may still be presented (race tolerance). */
const ROTATION_GRACE_MS = 30_000;

/**
 * Issues short-lived JWT access tokens and manages opaque, rotating refresh
 * tokens persisted (hashed) in the database.
 *
 * Refresh tokens belong to a "family": rotating a token revokes the old one
 * and creates a successor in the same family. Presenting an already-revoked
 * token is treated as theft and revokes the entire family.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  get accessTtlSeconds(): number {
    return this.config.auth.accessTtlSeconds;
  }

  async signAccessToken(userId: string, familyId: string): Promise<string> {
    const payload: AccessTokenPayload = { sub: userId, sid: familyId, type: 'access' };
    return this.jwt.signAsync(payload, {
      secret: this.config.auth.accessSecret,
      expiresIn: this.config.auth.accessTtlSeconds,
    });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.auth.accessSecret,
      });
      if (payload.type !== 'access' || !payload.sub || !payload.sid) return null;
      return payload;
    } catch {
      return null;
    }
  }

  static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private generateRefreshToken(): string {
    return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  }

  private refreshExpiry(): Date {
    return new Date(Date.now() + this.config.auth.refreshTtlDays * DAY_MS);
  }

  /** Starts a brand-new session family (login / register). */
  async createSession(userId: string, meta: ClientMetadata): Promise<IssuedSession> {
    const refreshToken = this.generateRefreshToken();
    const familyId = randomUUID();
    const expiresAt = this.refreshExpiry();
    await this.prisma.refreshSession.create({
      data: {
        userId,
        familyId,
        tokenHash: TokenService.hashToken(refreshToken),
        expiresAt,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });
    return { familyId, refreshToken, expiresAt };
  }

  /**
   * Rotates a refresh token. Returns the successor token and the owning user.
   * Throws UnauthorizedAppException for unknown, expired or reused tokens.
   */
  async rotateSession(
    refreshToken: string,
    meta: ClientMetadata,
  ): Promise<IssuedSession & { userId: string }> {
    const tokenHash = TokenService.hashToken(refreshToken);
    const current = await this.prisma.refreshSession.findUnique({ where: { tokenHash } });
    if (!current) {
      throw new UnauthorizedAppException('INVALID_REFRESH_TOKEN', 'نشست نامعتبر است');
    }
    if (current.revokedAt) {
      // Concurrent requests (several browser tabs, RSC prefetches) may present
      // the same token moments apart. A rotated token is therefore tolerated
      // for a short grace window; presenting it later is treated as theft and
      // the whole family is revoked.
      const rotated = current.lastUsedAt !== null;
      const withinGrace = Date.now() - current.revokedAt.getTime() <= ROTATION_GRACE_MS;
      if (!rotated || !withinGrace || !(await this.isFamilyActive(current.familyId))) {
        this.logger.warn({
          message: 'Refresh token reuse detected; revoking session family',
          userId: current.userId,
          familyId: current.familyId,
        });
        await this.revokeFamily(current.familyId);
        throw new UnauthorizedAppException('REFRESH_TOKEN_REUSED', 'نشست باطل شده است');
      }
    }
    if (current.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedAppException('REFRESH_TOKEN_EXPIRED', 'نشست منقضی شده است');
    }

    const successor = this.generateRefreshToken();
    const expiresAt = this.refreshExpiry();
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.refreshSession.update({
        where: { id: current.id },
        // `lastUsedAt` marks a rotation (as opposed to a logout revocation).
        data: { revokedAt: current.revokedAt ?? now, lastUsedAt: now },
      }),
      this.prisma.refreshSession.create({
        data: {
          userId: current.userId,
          familyId: current.familyId,
          tokenHash: TokenService.hashToken(successor),
          expiresAt,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      }),
    ]);
    return {
      userId: current.userId,
      familyId: current.familyId,
      refreshToken: successor,
      expiresAt,
    };
  }

  /** True when the family still has a live (non-revoked, non-expired) session. */
  async isFamilyActive(familyId: string): Promise<boolean> {
    const live = await this.prisma.refreshSession.findFirst({
      where: { familyId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    return live !== null;
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeByRefreshToken(refreshToken: string): Promise<void> {
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: TokenService.hashToken(refreshToken) },
      select: { familyId: true },
    });
    if (session) await this.revokeFamily(session.familyId);
  }

  /** Revokes every session of a user, optionally keeping one family alive. */
  async revokeAllForUser(userId: string, exceptFamilyId?: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptFamilyId ? { familyId: { not: exceptFamilyId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
  }

  /** Housekeeping: deletes sessions that expired or were revoked long ago. */
  async purgeExpired(olderThanDays = 7): Promise<number> {
    const threshold = new Date(Date.now() - olderThanDays * DAY_MS);
    const result = await this.prisma.refreshSession.deleteMany({
      where: { OR: [{ expiresAt: { lt: threshold } }, { revokedAt: { lt: threshold } }] },
    });
    return result.count;
  }
}
