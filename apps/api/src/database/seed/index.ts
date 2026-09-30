import type { PrismaClient } from '../../generated/prisma/client.js';
import { createSeedClient } from './client.js';
import { seedRbac } from './rbac.seed.js';
import { seedAdmin, type SeedAdminOptions } from './users.seed.js';

export interface SeedSummary {
  roles: number;
  permissions: number;
  adminEmail: string;
}

export interface SeedOptions {
  prisma?: PrismaClient;
  databaseUrl?: string;
  admin?: SeedAdminOptions;
}

export async function seedDatabase(options: SeedOptions = {}): Promise<SeedSummary> {
  const ownsClient = !options.prisma;
  const prisma = options.prisma ?? createSeedClient(options.databaseUrl);
  try {
    const rbac = await seedRbac(prisma);
    const admin = await seedAdmin(prisma, options.admin);
    return { ...rbac, adminEmail: admin.email };
  } finally {
    if (ownsClient) {
      await prisma.$disconnect();
    }
  }
}
