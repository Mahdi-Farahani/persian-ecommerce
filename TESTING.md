# Testing Strategy

## Testing Pyramid

```text
             E2E
          /       \
      Integration
       /           \
       Unit Tests
```

---

# 1. Unit Tests

Test:

* services
* pricing calculations
* discount calculations
* inventory calculations
* validation
* authentication logic
* authorization
* order state transitions

---

# 2. Integration Tests

Test:

* database interactions
* repositories
* authentication
* cart
* checkout
* orders
* payments
* inventory

---

# 3. E2E Tests

Critical flows:

## Registration

```text
Register
→ Login
→ Profile
```

## Shopping

```text
Browse
→ Product
→ Variant
→ Cart
→ Checkout
```

## Payment

```text
Checkout
→ Payment
→ Verification
→ Order
```

## Order

```text
Order
→ Processing
→ Shipment
→ Delivery
```

## Review

```text
Purchase
→ Delivered
→ Review
```

---

# 4. Frontend Tests

Test:

* components
* forms
* validation
* cart interactions
* authentication
* checkout
* responsive behavior where practical

---

# 5. Required Checks

Before considering any phase complete:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Exact commands may differ depending on package manager and project setup.

Use the actual scripts defined in `package.json`.

---

# 6. Docker Verification

Run:

```bash
docker compose build
docker compose up -d
```

Then verify:

```text
frontend reachable
backend reachable
database healthy
nginx healthy
health endpoint works
```

Run smoke tests against the running environment.

---

# 7. Failure Policy

Never delete a failing test merely to make CI green.

Never weaken assertions without documented justification.

Always identify the root cause.

---

# 8. Test Data

Provide deterministic seed data.

Tests must not depend on production data.

---

# 9. Regression Testing

When fixing a bug:

1. reproduce it
2. create a regression test
3. fix it
4. run the test
5. run the complete relevant test suite

---

# 10. Completion Standard

A phase is complete only when all applicable checks pass.

---

# 11. Actual Commands (as built)

Run from the repository root:

```bash
pnpm lint                     # ESLint in every workspace
pnpm typecheck                # tsc --noEmit in every workspace
pnpm test                     # vitest unit tests (api, shared) + component tests (web)
pnpm test:integration         # api integration tests (needs MariaDB; uses <db>_test)
pnpm build                    # production builds (shared, api, web)
pnpm format:check             # prettier
docker compose build && docker compose up -d
```

Layout:

* `apps/api/src/**/*.spec.ts` — unit tests (mocked Prisma, no database).
* `apps/api/test/**/*.integration-spec.ts` — boot the real Nest app via
  `createTestApp()` against MariaDB; migrations + seed run in global setup.
* `apps/web/src/**/*.test.tsx` — React Testing Library component tests (jsdom).
* `packages/shared/src/**/*.test.ts` — pure unit tests.

The Nest integration harness (`test/utils/test-app.ts`) applies the same
`configureApp()` used in production so filters, pipes and headers are tested
as deployed.

### Orders & payments coverage (as built)

* `apps/api/test/orders-payments.integration-spec.ts` boots the real app
  against the test database and walks: checkout → stock reservation →
  mock gateway → callback → server-side verification → order `PAID` →
  duplicate callback idempotency; failed attempt + retry; user
  cancellation; unknown/mismatched callbacks; amount mismatch (tampered
  adapter registered through `PaymentProviderFactory.register`); customer
  re-verify; order expiry releasing stock, a late payment flagged
  `ORDER_NOT_PENDING` and its refund; admin status/shipment transitions,
  reconciliation, encrypted gateway credentials (masked, never returned,
  production confirmation), connection and test payments, RBAC (403s).
* `apps/api/src/payments/providers/provider-contract.suite.ts` is run for
  every adapter (create, invalid credentials, provider error, callback
  parsing, verify success/failure/duplicate, transaction mismatch, network
  failure) with a stubbed `fetch`; ZarinPal fixtures use the JSON shapes
  verified from the official SDK sources.
* Unit specs cover credential encryption (`credentials-crypto.service.spec.ts`),
  amount conversion (`amount.util.spec.ts`) and the order state machine
  (`orders/order-status.spec.ts`).
* The test environment sets `PAYMENT_MOCK_ENABLED=true` and
  `PAYMENT_MOCK_DEFAULT=true` (`apps/api/test/setup-integration.ts`).

### Reviews, wishlist, search and inventory coverage (as built)

* `apps/api/test/reviews-wishlist.integration-spec.ts`: anonymous
  eligibility, one review per customer, verified-purchase flag via a paid
  mock order, hidden pending reviews, approve/reject with audit and rating
  recomputation, owner-only edit/delete, wishlist add/list/remove/move-to-cart
  and privacy between users.
* `apps/api/test/search.integration-spec.ts`: Persian/English/partial/
  Arabic-script queries, typo tolerance, filters, sorting, pagination, empty
  results, autocomplete and admin reindex.
* `apps/api/test/inventory.integration-spec.ts`: concurrent checkouts,
  sale/return/cancel ledger effects, manual adjustments, list/summary
  endpoints.

### Marketplace and administration coverage (as built)

* `apps/api/test/marketplace.integration-spec.ts`: seller application and
  approval (SELLER role granted/revoked), duplicate and invalid
  applications, offers appearing on the storefront with seller identity,
  tenant isolation (a seller cannot read or change another seller's offers,
  stock, orders or shipments), an order split between a seller and platform
  stock with commission snapshots, per-seller dispatch advancing the order
  only when everyone has shipped, settlement creation/payment/cancellation
  rules and suspension hiding offers.
* `apps/api/test/admin-dashboard.integration-spec.ts`: dashboard metric
  consistency, audit-log filters and redaction, permission enforcement.
* `apps/api/test/admin-permissions.integration-spec.ts`: authorization
  matrix over every admin read endpoint for anonymous, customer, plain
  ADMIN and SUPER_ADMIN callers, plus secret-free admin responses.
* The integration global setup reseeds with `resetInventory: true` so paid
  orders from earlier runs never deplete the shared fixtures.

### Browser end-to-end suite (`apps/e2e`)

Playwright tests run against an already running stack (default
`http://localhost:8080`, the Docker Compose stack through nginx; override
with `E2E_BASE_URL`). They need the mock gateway at checkout
(`PAYMENT_MOCK_ENABLED=true`, `PAYMENT_MOCK_DEFAULT=true`,
`API_NODE_ENV=development` in `.env`) and the seeded admin password in
`E2E_ADMIN_PASSWORD` (or `SEED_ADMIN_PASSWORD`).

```bash
docker compose up -d
E2E_ADMIN_PASSWORD='…' pnpm test:e2e            # customer, admin and seller flows
PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm test:e2e   # reuse a preinstalled browser
```

Flows: `customer-flow.spec.ts` (register → browse → search → product →
cart → checkout → mock payment → order history → review),
`admin-flow.spec.ts` (catalogue creation, publish, inventory, orders,
dashboard, audit log) and `seller-flow.spec.ts` (application → approval →
offer → order → fulfilment → settlement).

### Security regression suite (as built)

`apps/api/test/security.integration-spec.ts` checks hardened response
headers and error envelopes, the CSRF header rule for cookie sessions (and
its absence for bearer tokens), strict DTO validation (unknown fields,
ranges, lengths), hostile search input (SQL/boolean-mode/HTML payloads) and
account-enumeration resistance on login and password reset.
