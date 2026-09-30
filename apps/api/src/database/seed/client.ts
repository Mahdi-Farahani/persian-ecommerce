import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../generated/prisma/client.js';

/** Standalone Prisma client for scripts that run outside the Nest container. */
export function createSeedClient(databaseUrl = process.env['DATABASE_URL']): PrismaClient {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run the seed');
  }
  const url = new URL(databaseUrl);
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    connectionLimit: 5,
    timezone: 'Z',
    allowPublicKeyRetrieval: true,
  });
  return new PrismaClient({ adapter });
}
