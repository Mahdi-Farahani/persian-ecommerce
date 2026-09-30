import {
  ALL_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  ROLE_PERMISSIONS,
  RoleName,
} from '../../rbac/permissions.js';
import type { PrismaClient } from '../../generated/prisma/client.js';

const ROLE_DESCRIPTIONS: Record<string, string> = {
  CUSTOMER: 'مشتری فروشگاه',
  SELLER: 'فروشنده بازار',
  ADMIN: 'مدیر سیستم',
  SUPER_ADMIN: 'مدیر ارشد با دسترسی کامل',
};

export async function seedRbac(
  prisma: PrismaClient,
): Promise<{ roles: number; permissions: number }> {
  for (const key of ALL_PERMISSIONS) {
    const meta = PERMISSION_DESCRIPTIONS[key];
    await prisma.permission.upsert({
      where: { key },
      update: { group: meta.group, description: meta.description },
      create: { key, group: meta.group, description: meta.description },
    });
  }

  const permissions = await prisma.permission.findMany({ select: { id: true, key: true } });
  const idByKey = new Map(permissions.map((p) => [p.key, p.id] as const));

  for (const name of Object.values(RoleName)) {
    const role = await prisma.role.upsert({
      where: { name },
      update: { description: ROLE_DESCRIPTIONS[name], isSystem: true },
      create: { name, description: ROLE_DESCRIPTIONS[name], isSystem: true },
    });
    const wanted = ROLE_PERMISSIONS[name];
    // System roles are reconciled to their canonical permission bundle.
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permission: { key: { notIn: [...wanted] } } },
    });
    for (const key of wanted) {
      const permissionId = idByKey.get(key);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }

  return { roles: Object.values(RoleName).length, permissions: ALL_PERMISSIONS.length };
}
