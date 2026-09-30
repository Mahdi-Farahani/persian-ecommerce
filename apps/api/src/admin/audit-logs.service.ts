import { Injectable } from '@nestjs/common';
import { buildPagination, type AuditLogView, type Paginated } from '@pe/shared';
import { redactSecrets } from '../audit/audit.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuditLogsQueryDto } from './dto/admin.dto.js';

const include = {
  actor: { select: { id: true, email: true, firstName: true, lastName: true } },
} satisfies Prisma.AuditLogInclude;
type Row = Prisma.AuditLogGetPayload<{ include: typeof include }>;

function toView(row: Row): AuditLogView {
  return {
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    actor: row.actor
      ? {
          id: row.actor.id,
          name:
            [row.actor.firstName, row.actor.lastName].filter(Boolean).join(' ') ||
            row.actor.email ||
            '',
          email: row.actor.email,
        }
      : null,
    metadata: redactSecrets(row.metadata),
    ipAddress: row.ipAddress,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Read side of the audit trail (writes go through AuditService). */
@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AuditLogsQueryDto): Promise<Paginated<AuditLogView>> {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.action) where.action = { startsWith: query.action };
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.actorId) where.actorId = query.actorId;
    if (query.from || query.to) {
      where.createdAt = {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      };
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
    ]);
    return { items: rows.map(toView), pagination: buildPagination(query.page, query.limit, total) };
  }

  async recent(limit: number): Promise<AuditLogView[]> {
    const rows = await this.prisma.auditLog.findMany({
      include,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(toView);
  }

  /** Distinct action names, for filter dropdowns. */
  async actions(): Promise<string[]> {
    const rows = await this.prisma.auditLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    });
    return rows.map((r) => r.action);
  }
}
