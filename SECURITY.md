# Security

This document describes the security architecture of the platform as built,
the threat model it was designed against, known limitations and operational
recommendations. It is updated with every phase; the hardening review of
Phase 12 is recorded at the end.

## 1. Architecture

```
Internet ──TLS──▶ Nginx (rate limits, security headers, only published ports)
                    ├── /            → Next.js (SSR, httpOnly cookies forwarded)
                    ├── /api/v1/*    → NestJS (auth guards, validation, RBAC)
                    ├── /uploads/*   → NestJS static (validated WebP only)
                    └── /health*     → NestJS
                                        └── MariaDB (backend network only)
```

* Only Nginx publishes ports; the API, web and database live on internal
  Docker networks (`backend` is not reachable from the web container).
* All configuration comes from environment variables; `.env` files, TLS
  certificates and uploads are git-ignored. `docker compose` refuses to start
  without `JWT_ACCESS_SECRET`, `PAYMENT_ENCRYPTION_KEY` and database
  passwords.

## 2. Authentication and sessions

* Passwords are hashed with Argon2id; the policy requires letters and digits
  (`@pe/shared` password rules) and is validated on registration, change and
  reset.
* Access tokens are short-lived HS256 JWTs (15 min) carrying only the user id
  and the session family; refresh tokens are opaque, hashed at rest, rotated
  on every use with reuse detection that revokes the whole family.
* Tokens travel as `httpOnly`, `SameSite=Lax` cookies (`Secure` in
  production) or as a Bearer header for API clients. Logout revokes the
  family; "logout everywhere" revokes all families.
* Login is throttled and locked after repeated failures
  (`LOGIN_MAX_FAILED_ATTEMPTS`, `LOGIN_LOCK_MINUTES`); password reset and
  verification codes are single-use and time-limited.
* Every route is protected by default (`JwtAuthGuard`); `@Public()` and
  `@OptionalAuth()` are explicit opt-outs reviewed per endpoint.

## 3. Authorization (RBAC)

* Permissions are granular (`orders.manage`, `payment_gateway.update`,
  `reviews.moderate`, `sellers.manage`, `seller.portal`, …) and bundled into
  roles (`CUSTOMER`, `SELLER`, `ADMIN`, `SUPER_ADMIN`). Guards check
  permissions, never role names, except the SUPER_ADMIN bypass.
* Privilege escalation is blocked server-side: users cannot change their own
  roles/status, granting privileged roles requires `roles.manage`, and
  sensitive payment operations are outside the default `ADMIN` bundle.
* Customer data is always scoped by `userId` (orders, payments, addresses,
  reviews, wishlist). Seller data is scoped by the caller's approved seller
  record on every request; the SELLER role is granted and revoked with the
  approval status, and suspended sellers' offers are deactivated.
* `test/admin-permissions.integration-spec.ts` and
  `test/marketplace.integration-spec.ts` are the regression suites for the
  authorization matrix and tenant isolation.

## 4. Input handling

* Every request body and query passes a global `ValidationPipe`
  (`whitelist`, `forbidNonWhitelisted`, transformation) with class-validator
  DTOs; unknown fields are rejected.
* Prisma parameterises all queries. The few raw SQL statements (inventory
  locks, fulltext search, dashboard aggregates) use tagged templates with
  bound parameters; search tokens are normalised and stripped of boolean
  operators before use.
* Money is integer IRR (`BigInt`); DTOs bound amounts, quantities and
  lengths. Persian/Arabic digits are normalised where numbers are accepted.
* Uploads are decoded with sharp, re-encoded to WebP (max 1600px), stored
  under random names and served with `nosniff`; client MIME types and file
  names are never trusted.
* API errors use one envelope; stack traces are never returned, and internal
  error messages are only exposed outside production.

## 5. Cross-site protections

* CSRF: cookie-authenticated state-changing requests must carry the
  `X-Requested-With` header (or an allowed `Origin`); browsers only send it
  after a CORS preflight limited to `CORS_ORIGINS`. Payment callbacks are
  public and change nothing without provider verification.
* XSS: React escapes output; the storefront does not render user HTML;
  Helmet sets `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`
  and friends on the API, and Nginx repeats them for every response.
* Cookies never carry secrets other than the session tokens.

## 6. Payments

See `docs/payments/PAYMENT-SECURITY.md`. In short: credentials are
AES-256-GCM encrypted at rest with a key that never enters the database,
masked in every response, and never logged; callbacks are untrusted and
always verified server-side with amount and transaction cross-checks;
verification is claimed atomically so duplicate callbacks cannot
double-finalize; going live in production requires explicit confirmation;
the mock gateway is refused in production.

## 7. Audit logging

Sensitive administrative actions (user status/roles, catalogue changes,
inventory adjustments, order status and shipments, coupon and shipping
changes, payment gateway configuration and tests, refunds and
reconciliation, review moderation, seller approval and settlements) write an
immutable `audit_logs` row with actor, action, entity, redacted metadata, IP
and user agent. Metadata passes through `redactSecrets`, which drops values
whose keys look like passwords, secrets, tokens or credentials.

## 8. Rate limiting and abuse

* Nginx applies per-IP request limits (stricter for `/api/`) and connection
  limits; the API applies a global throttler with stricter limits on
  authentication endpoints.
* Carts are capped in lines and quantity; wishlists in items; review text
  and titles in length; one review per product per user.
* Unpaid orders expire and release stock automatically.

## 9. Threat model

| Threat | Mitigation |
| --- | --- |
| Credential stuffing / brute force | Argon2id, lockout, throttling, no user enumeration on login |
| Session theft / replay | httpOnly cookies, short access tokens, rotating refresh tokens with reuse detection |
| CSRF | custom header requirement + CORS allow-list, SameSite=Lax |
| Horizontal privilege escalation (reading others' orders, sellers reading other sellers) | user/seller scoped queries, regression tests |
| Vertical privilege escalation | permission-based guards, self-modification blocks, role grant checks |
| Price/inventory tampering from the client | server recomputes every total; stock is locked and reserved in transactions |
| Fake payment success | provider verification, claim-based idempotency, amount cross-check |
| Secret leakage | env-only secrets, encrypted gateway credentials, masked responses, redacted logs and audits |
| Injection | Prisma parameters, tagged raw SQL, validation pipe |
| Malicious uploads | sharp re-encoding, random names, size/dimension limits, `nosniff` |
| Denial of service | Nginx and API rate limits, bounded pagination, request size limits |

## 10. Known limitations

* No two-factor authentication; phone/email verification exists but is not
  enforced for login.
* No Web Application Firewall or bot detection beyond rate limits.
* Content Security Policy is not enforced on the storefront (Next.js inline
  scripts and third-party fonts would need nonces); add one once assets are
  finalised.
* Payment adapters for SnappPay, DigiPay and TorobPay are built on
  unverified documentation and are gated until confirmed against the
  contract documents.
* Refund execution for card gateways depends on provider capabilities
  (ZarinPal reverse only); other refunds are recorded manually.
* Audit logs are append-only by convention, not by database privilege.

## 11. Operational recommendations

* Terminate TLS at Nginx with a valid certificate (`tls.conf.example`),
  keep `COOKIE_SECURE=true`, set `APP_URL`/`API_PUBLIC_URL` to the public
  HTTPS origin and restrict `CORS_ORIGINS` to it.
* Rotate `JWT_ACCESS_SECRET` to log everyone out; rotate
  `PAYMENT_ENCRYPTION_KEY` only together with re-entering gateway
  credentials.
* Keep `SWAGGER_ENABLED=false`, `PAYMENT_MOCK_ENABLED=false` and
  `API_NODE_ENV=production` in production.
* Restrict `/admin` at the network level (VPN or IP allow-list in Nginx) in
  addition to RBAC.
* Back up the database daily (see `DEPLOYMENT.md`); the audit log and payment
  ledger are part of the financial record.
* Run `pnpm audit --prod` before each release and apply the overrides in
  `package.json` when upstream fixes are not yet released.
* Change the bootstrap admin password after the first login and create
  named administrator accounts instead of sharing it.

## 12. Production verification (as built)

Verified on the Compose stack before release (repeat on the real host):

| Control | How it is verified |
| --- | --- |
| HTTPS | `tls.conf.example` (TLS 1.2/1.3, HSTS, HTTP→HTTPS redirect); `curl -I http://host` returns `301` |
| Security headers | `curl -I https://host/` and `/api/v1/products`: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` once each (nginx is the single source; upstream copies are hidden), `server_tokens off`, no `X-Powered-By` |
| No debug mode | API container runs `NODE_ENV=production`; `/api/docs` returns `404` with `SWAGGER_ENABLED=false`; error envelopes carry `requestId`, never stack traces |
| No secrets in git | `git ls-files | grep -E '(^|/)\.env'` lists only `.env.example` files; `infra/nginx/certs` and `infra/docker/certs` are git-ignored |
| No exposed database | `docker compose config` publishes ports only on `nginx`; MariaDB sits on the `backend` network without a host port |
| No unnecessary ports | `80`/`443` only; `ss -ltnp` on the host shows nothing else from the stack |
| Restricted admin access | `/admin` and `/api/v1/admin/*` require ADMIN/SUPER_ADMIN (authorization matrix test); add an IP allow-list to the nginx `location /admin` for defence in depth |
| Mock gateway | refused at runtime when `NODE_ENV=production` regardless of `.env` |
