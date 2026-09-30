import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma CLI configuration (schema location, migrations, seed command).
 * `DATABASE_URL` is read from the environment; `.env` is loaded for local use.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node --import tsx src/database/seed.ts',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
