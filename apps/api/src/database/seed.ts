/**
 * Deterministic, idempotent seed entry point.
 *
 * Development: `pnpm prisma:seed` (reads DATABASE_URL from apps/api/.env)
 * Production image: `node dist/database/seed.js`
 *
 * Safe to rerun: every record is upserted by a stable natural key.
 */
import 'dotenv/config';
import { seedDatabase } from './seed/index.js';

seedDatabase()
  .then((summary) => {
    console.log('Seed completed:', JSON.stringify(summary));
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
