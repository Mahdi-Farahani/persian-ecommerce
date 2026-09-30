# بازارچه — Persian E-Commerce Platform

A production-oriented, Persian-first (RTL) marketplace platform built as a
modular monorepo:

| Layer      | Technology                                           |
| ---------- | ---------------------------------------------------- |
| Frontend   | Next.js 16 (App Router, Server Components), React 19, Tailwind CSS 4, Zustand, React Hook Form + Yup |
| Backend    | NestJS 12 (ESM), Prisma 7 (MariaDB driver adapter), class-validator, Swagger |
| Database   | MariaDB 11                                           |
| Infra      | Docker Compose, Nginx reverse proxy                  |
| Language   | TypeScript 6 (strict) everywhere                     |

## Repository layout

```text
apps/
├── api/        NestJS REST API (prisma schema, migrations, seed)
└── web/        Next.js storefront + admin + seller panels
packages/
└── shared/     Framework-agnostic utilities (money, Persian formatting, API contracts)
infra/
├── nginx/      Reverse proxy configuration (HTTP + TLS example)
└── docker/     Extra CA certificates hook for builds behind proxies
docs/           Additional documentation (payments, …)
phases/         Phase-by-phase requirements
```

Authoritative documentation: `REQUIREMENTS.md`, `ARCHITECTURE.md`,
`DATABASE.md`, `API.md`, `TESTING.md`, `DEPLOYMENT.md`.

## Prerequisites

- Node.js ≥ 22.22 (Node 24 LTS recommended)
- pnpm 10 (`corepack enable`)
- Docker + Docker Compose v2

## Local development

```bash
pnpm install

# 1. database
docker compose -f docker-compose.dev.yml up -d

# 2. api
cp apps/api/.env.example apps/api/.env      # adjust DATABASE_URL if needed
pnpm --filter @pe/shared build
pnpm --filter @pe/api prisma:generate
pnpm --filter @pe/api prisma:migrate:dev
pnpm --filter @pe/api prisma:seed           # roles, permissions, bootstrap admin
pnpm dev:api                                # http://localhost:4000 (Swagger: /api/docs)

# 3. web
cp apps/web/.env.example apps/web/.env.local
pnpm dev:web                                # http://localhost:3000
```

The seed prints a generated admin password unless `SEED_ADMIN_PASSWORD` is set.

## Quality checks

```bash
pnpm lint                 # ESLint (all workspaces)
pnpm typecheck            # tsc --noEmit (all workspaces)
pnpm test                 # unit + component tests (vitest)
pnpm test:integration     # API integration tests against MariaDB (uses <db>_test)
pnpm build                # production builds
pnpm format:check         # prettier
```

## Docker Compose (production-like)

```bash
cp .env.example .env      # set MARIADB_* passwords, APP_URL, SEED_ADMIN_PASSWORD
docker compose build
docker compose up -d
docker compose ps
```

Nginx listens on `NGINX_HTTP_PORT` (default 80). Routes:

- `/` → Next.js
- `/api/*`, `/health`, `/health/ready` → NestJS
- `/api/docs` → Swagger UI (only when `SWAGGER_ENABLED=true`)

The API container applies migrations on start (`RUN_MIGRATIONS_ON_START`) and
optionally seeds base data (`SEED_ON_START`). See `DEPLOYMENT.md` for TLS,
backups and rollback.

## Money

All amounts are integers in **Iranian Rial (IRR)** stored as `BIGINT`. The UI
formats prices in Toman (÷10) with Persian digits. Never use floating point for
money; use the helpers in `@pe/shared`.

## Licence

Proprietary — all rights reserved.
