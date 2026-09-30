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
