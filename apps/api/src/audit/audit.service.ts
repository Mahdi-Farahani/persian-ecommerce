import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  request?: Pick<Request, 'ip' | 'header'>;
}

const SECRET_KEY_PATTERN = /(password|secret|token|key|credential|authorization)/i;

/** Removes values whose key looks like a secret before persisting metadata. */
export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEY_PATTERN.test(key) ? '[redacted]' : redactSecrets(inner);
    }
    return out;
  }
  return value;
}

/**
 * Persists an immutable trail of sensitive administrative actions.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          metadata: entry.metadata
            ? (redactSecrets(entry.metadata) as Prisma.InputJsonValue)
            : undefined,
          ipAddress: entry.request?.ip ?? null,
          userAgent: entry.request?.header('user-agent')?.slice(0, 255) ?? null,
        },
      });
    } catch (error) {
      // Auditing must never break the primary operation, but the failure is loud.
      this.logger.error(
        `Failed to write audit log for ${entry.action}: ${(error as Error).message}`,
      );
    }
  }
}
