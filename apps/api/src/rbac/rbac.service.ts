import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface PermissionSummary {
  key: string;
  group: string;
  description: string | null;
}

export interface RoleSummary {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async listRoles(): Promise<RoleSummary[]> {
    const roles = await this.prisma.role.findMany({
      include: {
        permissions: { include: { permission: { select: { key: true } } } },
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });
    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.permissions.map((rp) => rp.permission.key).sort(),
      userCount: role._count.users,
    }));
  }

  async listPermissions(): Promise<PermissionSummary[]> {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });
    return permissions.map((p) => ({ key: p.key, group: p.group, description: p.description }));
  }
}
