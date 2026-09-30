import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { RoleName } from '../../rbac/permissions.js';

export interface SeedAdminOptions {
  email?: string;
  password?: string;
}

const DEFAULT_ADMIN_EMAIL = 'admin@example.com';

/**
 * Creates (or updates) the bootstrap super administrator.
 *
 * - When a password is supplied (option or SEED_ADMIN_PASSWORD) it is applied
 *   deterministically on every run.
 * - When no password is supplied and the admin does not exist yet, a random
 *   password is generated and printed once, so no default credential ships.
 * - When no password is supplied and the admin exists, the password is kept.
 */
export async function seedAdmin(
  prisma: PrismaClient,
  options: SeedAdminOptions = {},
): Promise<{ email: string; generatedPassword?: string }> {
  const email = (
    options.email ??
    process.env['SEED_ADMIN_EMAIL'] ??
    DEFAULT_ADMIN_EMAIL
  ).toLowerCase();
  const providedPassword = options.password ?? process.env['SEED_ADMIN_PASSWORD'] ?? undefined;
  const superAdmin = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.SuperAdmin } });

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  let generatedPassword: string | undefined;
  let userId: string;

  if (existing) {
    userId = existing.id;
    const data: { status: 'ACTIVE'; passwordHash?: string } = { status: 'ACTIVE' };
    if (providedPassword) {
      data.passwordHash = await argon2.hash(providedPassword, { type: argon2.argon2id });
    }
    await prisma.user.update({ where: { id: userId }, data });
  } else {
    const password = providedPassword ?? randomBytes(12).toString('base64url');
    if (!providedPassword) generatedPassword = password;
    const created = await prisma.user.create({
      data: {
        email,
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        firstName: 'مدیر',
        lastName: 'سیستم',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    });
    userId = created.id;
  }

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId: superAdmin.id } },
    update: {},
    create: { userId, roleId: superAdmin.id },
  });

  if (generatedPassword) {
    console.log(`Generated bootstrap admin password for ${email}: ${generatedPassword}`);
  }

  return { email, generatedPassword };
}
