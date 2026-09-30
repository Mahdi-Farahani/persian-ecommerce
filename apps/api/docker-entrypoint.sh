#!/bin/sh
# Production entrypoint for the API container.
#
# 1. Applies pending Prisma migrations (deterministic, forward-only).
# 2. Optionally seeds base data (roles, permissions, bootstrap admin) when
#    SEED_ON_START=true. The seed is idempotent.
# 3. Starts the NestJS server.
set -eu

cd /app/apps/api

if [ "${RUN_MIGRATIONS_ON_START:-true}" = "true" ]; then
  echo "[entrypoint] applying database migrations"
  ./node_modules/.bin/prisma migrate deploy
fi

if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "[entrypoint] running database seed"
  node dist/database/seed.js
fi

echo "[entrypoint] starting api"
exec node dist/main.js
