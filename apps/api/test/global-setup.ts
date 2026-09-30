/**
 * Vitest global setup for integration tests.
 *
 * 1. Ensures the test database exists (creating it when the connection user
 *    has the privilege).
 * 2. Applies all Prisma migrations with `prisma migrate deploy`.
 * 3. Seeds roles/permissions and the bootstrap admin.
 */
import { execFileSync } from 'node:child_process';
import 'dotenv/config';
import mariadb from 'mariadb';
import { seedDatabase } from '../src/database/seed/index.js';

export const TEST_ADMIN_EMAIL = 'admin@test.local';
export const TEST_ADMIN_PASSWORD = 'Test-Admin-Passw0rd!';

function resolveTestDatabaseUrl(): string {
  const explicit = process.env['TEST_DATABASE_URL'];
  if (explicit) return explicit;
  const base = process.env['DATABASE_URL'];
  if (!base) {
    throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set for integration tests');
  }
  const url = new URL(base);
  url.pathname = `${url.pathname.replace(/\/$/, '')}_test`;
  return url.toString();
}

async function ensureDatabase(databaseUrl: string): Promise<void> {
  const url = new URL(databaseUrl);
  const database = url.pathname.replace(/^\//, '');
  const connection = await mariadb.createConnection({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    allowPublicKeyRetrieval: true,
  });
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await connection.end();
  }
}

export default async function globalSetup(): Promise<void> {
  const databaseUrl = resolveTestDatabaseUrl();
  process.env['TEST_DATABASE_URL'] = databaseUrl;
  await ensureDatabase(databaseUrl);
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  await seedDatabase({
    databaseUrl,
    admin: { email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD },
    // Paid orders consume fixture stock; start every run from the seed quantities.
    resetInventory: true,
  });
}
