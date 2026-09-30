# System Architecture

## 1. Architecture Overview

Use a modular monorepo.

Recommended structure:

```text
apps/
├── web/
└── api/

packages/
├── config/
├── types/
├── ui/
└── validation/

infra/
├── nginx/
└── docker/

phases/
```

The exact structure may be adapted if a better implementation is justified.

---

# 2. Frontend Architecture

Next.js application.

Recommended organization:

```text
app/
├── (store)/
├── account/
├── cart/
├── checkout/
├── products/
├── categories/
├── admin/
└── seller/
```

Use:

* Server Components by default
* Client Components only when necessary
* Zustand for client state
* React Hook Form for forms
* Yup for validation
* Tailwind CSS

---

# 3. Backend Architecture

NestJS modular architecture.

Example:

```text
src/
├── auth/
├── users/
├── roles/
├── products/
├── categories/
├── brands/
├── attributes/
├── inventory/
├── cart/
├── checkout/
├── orders/
├── payments/
├── shipping/
├── discounts/
├── coupons/
├── reviews/
├── wishlist/
├── sellers/
├── notifications/
├── admin/
└── common/
```

Each domain module should own its:

* controller
* service
* DTOs
* business logic
* repository/data access where appropriate
* tests

---

# 4. API Architecture

REST API prefix:

```text
/api/v1
```

Examples:

```text
GET    /api/v1/products
GET    /api/v1/products/:id
POST   /api/v1/products
PATCH  /api/v1/products/:id
DELETE /api/v1/products/:id
```

Authentication:

```text
/api/v1/auth/*
```

---

# 5. Authentication

Use secure authentication.

Requirements:

* password hashing
* access tokens
* refresh mechanism where appropriate
* session invalidation
* password reset
* email/phone verification architecture

Never store plaintext passwords.

---

# 6. Authorization

Use RBAC.

Initial roles:

```text
CUSTOMER
SELLER
ADMIN
SUPER_ADMIN
```

Permissions should be granular enough to support future expansion.

---

# 7. State Management

Zustand should be used for client-side state where appropriate.

Do not put server data into Zustand unnecessarily.

Prefer server data fetching patterns for server state.

Cart state must remain authoritative on the backend.

---

# 8. Database

MariaDB + Prisma.

The database is the source of truth for:

* users
* products
* orders
* inventory
* payments
* sellers
* financial records

Use normalized relational structures where appropriate.

---

# 9. Caching

Caching may be introduced when justified.

Redis can be added for:

* sessions
* rate limiting
* caching
* temporary checkout state
* queues

Do not use Redis as the source of truth for critical financial data.

---

# 10. Background Jobs

Long-running operations should not block HTTP requests.

Potential future worker responsibilities:

* email
* SMS
* image processing
* search indexing
* notifications
* reports

Use a queue when justified.

---

# 11. Search

Initial implementation may use MariaDB-compatible search techniques.

The architecture must isolate search behind a service interface.

Future:

```text
SearchService
    ↓
MariaDBSearchService

or

SearchService
    ↓
Elasticsearch/OpenSearch/Meilisearch
```

The rest of the application should not depend directly on the search engine.

---

# 12. File Storage

Product images should use an object storage abstraction.

Do not tightly couple business logic to a specific provider.

Possible providers:

* S3-compatible storage
* local development storage
* cloud object storage

---

# 13. Nginx

Nginx is the public reverse proxy.

Example:

```text
Internet
   |
 Nginx
   |
   +---- /api/* ----> NestJS
   |
   +---------------> Next.js
```

Nginx should handle:

* TLS termination
* HTTP → HTTPS redirect
* reverse proxy
* security headers where appropriate
* static asset optimization where appropriate

---

# 14. Docker

Every application component must have a production Dockerfile.

Docker Compose must provide a simple deployment:

```bash
docker compose up -d
```

Development may use:

```bash
docker compose up
```

---

# 15. Environment Variables

Never commit secrets.

Example:

```text
DATABASE_URL=
JWT_SECRET=
NEXT_PUBLIC_API_URL=
PAYMENT_PROVIDER_URL=
PAYMENT_PROVIDER_SECRET=
```

Provide:

```text
.env.example
```

---

# 16. Observability

The system should have:

* structured logs
* health endpoint
* readiness endpoint
* error logging
* request correlation where appropriate

Backend endpoints:

```text
/health
/health/ready
```

---

# 17. Error Handling

Use consistent API errors.

Example:

```json
{
  "success": false,
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Product not found"
  }
}
```

Never expose internal stack traces in production.

---

# 18. Transaction Boundaries

Use database transactions for operations requiring atomicity.

Examples:

* checkout
* order creation
* payment finalization
* inventory reservation
* refund

Avoid unnecessarily large transactions.

---

# 19. Scalability

Initial deployment should remain simple.

Target architecture:

```text
Nginx
  ↓
Next.js
  ↓
NestJS
  ↓
MariaDB
```

Additional components should be introduced only when justified by requirements.

Do not prematurely build Kubernetes infrastructure for the initial application.

---

# 20. Architectural Principle

Prefer:

```text
Simple
Modular
Testable
Observable
Upgradeable
```

over:

```text
Over-engineered
Distributed
Complex
Difficult to operate
```

---

# 21. Implementation Decisions (as built)

This section records how the architecture above is realised in the repository.
It is updated whenever an implementation decision changes.

## Monorepo

```text
apps/api          NestJS 12 (ESM, TypeScript 6 strict), Prisma 7, vitest
apps/web          Next.js 16 App Router, React 19, Tailwind CSS 4, vitest + Testing Library
packages/shared   Pure TypeScript helpers shared by both apps (money, Persian formatting, API contracts)
infra/nginx       Reverse proxy (HTTP config + TLS example)
infra/docker      Optional extra CA certificates for image builds behind TLS-inspecting proxies
```

Package manager: pnpm workspaces (`pnpm-workspace.yaml`). All versions are pinned exactly.

## Toolchain versions

* Node.js 22 LTS (`node:22-alpine` images); Node 24 LTS is supported for local development.
* TypeScript 6.0 — TypeScript 7 (native compiler) is not yet supported by
  `typescript-eslint`, `@nestjs/swagger` or `ts-jest`, so 6.x is the newest
  version the toolchain accepts.
* ESLint 10 for `api`/`shared`; ESLint 9 for `web` because
  `eslint-config-next` peers still require it.

## Backend conventions

* ESM output (`"type": "module"`, NodeNext resolution, `.js` import suffixes).
* `configureApp()` in `apps/api/src/app.setup.ts` wires helmet, CORS, cookies,
  validation pipe (`whitelist` + `forbidNonWhitelisted`), the global exception
  filter, request-id middleware and Swagger. Integration tests call the same
  function, so tests exercise production wiring.
* Errors always use `{ success: false, error: { code, message, details? } }`.
  Domain errors extend `AppException` with a stable `code`.
* Global prefix `/api/v1`; `/health` and `/health/ready` are exempt.
* Logging: Nest `ConsoleLogger` with JSON output in production, one access-log
  line per request including `requestId`, `durationMs` and status.
* Rate limiting: `@nestjs/throttler` globally (300 req/min per IP) plus stricter
  nginx zones for `/api/v1/auth/*`.

## Database access

* Prisma 7 with `@prisma/adapter-mariadb` (driver adapter; no Rust query engine).
  `prisma.config.ts` holds CLI configuration; migrations use the WASM schema
  engine so the production image needs no platform-specific engine binary.
* The generated client lives in `apps/api/src/generated/prisma` (git-ignored,
  generated during build).
* Seed code is compiled with the application (`src/database/seed`) so it can
  run inside the production image (`node dist/database/seed.js`).

## Frontend conventions

* Persian-first: `<html lang="fa" dir="rtl">`, self-hosted Vazirmatn variable
  font (OFL), logical CSS properties (`ps-`, `pe-`, `start`, `end`).
* All copy comes from the message catalogue in `apps/web/src/i18n`; components
  never hard-code Persian text.
* API access: `browserApi` (Client Components, same-origin `/api/v1` through
  nginx) and `serverApi`/`publicApi` (Server Components, internal Docker URL,
  cookies forwarded).
* Only `NEXT_PUBLIC_*` variables reach the browser bundle.

## Money

Amounts are integers in Iranian Rial (IRR), stored as `BIGINT`. The UI converts
to Toman (÷10) purely for display. See `packages/shared/src/money.ts`.

## Authentication (as built)

* Passwords: Argon2id (19 MiB, t=2). Login by email or Iranian mobile number.
* Access token: HS256 JWT, 15 min (`JWT_ACCESS_TTL_SECONDS`), payload
  `{ sub, sid (session family), type }`. Verified on every request together
  with a live-session check, so logout/suspension take effect immediately.
* Refresh token: opaque 48-byte random value, stored SHA-256 hashed in
  `refresh_sessions`, rotated on every use. Rotated tokens are tolerated for
  30 s (parallel requests); later reuse revokes the whole family.
* Cookies: `pe_access` and `pe_refresh` are httpOnly, SameSite=Lax, Secure in
  production. Tokens are also returned in the login body for non-browser clients.
* CSRF: cookie-authenticated non-GET requests must carry `X-Requested-With`
  (custom headers require a CORS preflight, which is restricted to
  `CORS_ORIGINS`) or an allowed `Origin`.
* Brute force: `LOGIN_MAX_FAILED_ATTEMPTS` failures lock the account for
  `LOGIN_LOCK_MINUTES`; auth endpoints have stricter throttling.
* Authorization: global `JwtAuthGuard` (routes protected by default,
  `@Public()` / `@OptionalAuth()` opt out) + `PermissionsGuard`
  (`@RequirePermissions()`, `@Roles()`); SUPER_ADMIN bypasses permission checks.
* Web: `src/proxy.ts` refreshes an expired access cookie before rendering and
  redirects anonymous visitors away from `/account`, `/checkout`, `/admin`,
  `/seller`. The browser API client retries once after a transparent refresh.
* Notifications: `NotificationProvider` abstraction (email/SMS); the logging
  provider is used until a real transport is configured.
