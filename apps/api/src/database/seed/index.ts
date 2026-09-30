import type { PrismaClient } from '../../generated/prisma/client.js';
import { defaultUploadsDir, seedCatalog, type CatalogSeedSummary } from './catalog.seed.js';
import { createSeedClient } from './client.js';
import { seedRbac } from './rbac.seed.js';
import { seedShipping } from './shipping.seed.js';
import { seedAdmin, type SeedAdminOptions } from './users.seed.js';

export interface SeedSummary {
  roles: number;
  permissions: number;
  adminEmail: string;
  catalog?: CatalogSeedSummary;
}

export interface SeedOptions {
  prisma?: PrismaClient;
  databaseUrl?: string;
  admin?: SeedAdminOptions;
  /** Seed the sample catalogue (defaults to true outside production). */
  catalog?: boolean;
  uploadsDir?: string;
}

export async function seedDatabase(options: SeedOptions = {}): Promise<SeedSummary> {
  const ownsClient = !options.prisma;
  const prisma = options.prisma ?? createSeedClient(options.databaseUrl);
  try {
    const rbac = await seedRbac(prisma);
    const admin = await seedAdmin(prisma, options.admin);
    await seedShipping(prisma);
    const summary: SeedSummary = { ...rbac, adminEmail: admin.email };
    const wantCatalog = options.catalog ?? process.env['SEED_CATALOG'] !== 'false';
    if (wantCatalog) {
      summary.catalog = await seedCatalog(prisma, options.uploadsDir ?? defaultUploadsDir());
    }
    return summary;
  } finally {
    if (ownsClient) {
      await prisma.$disconnect();
    }
  }
}
