# Payment security

## Credentials

- Stored only in `payment_provider_configs.credentialsEncrypted` as
  `v1:<iv>:<tag>:<ciphertext>` (AES-256-GCM, random 96-bit IV per write),
  key derived from `PAYMENT_ENCRYPTION_KEY` (`credentials-crypto.service.ts`).
- The key never enters the database. Rotating it requires re-entering
  credentials in the admin panel (old rows fail to decrypt and are treated as
  empty).
- Admin API responses expose `configured: true/false` and a masked value
  (`••••••••1234`) for secret fields; plain values are never returned.
- Submitting a masked or empty value keeps the stored credential; only a new
  plain value replaces it.
- Environment-variable bootstrap values are read once (row creation) so
  secrets do not need to stay in the environment afterwards.
- Frontend bundles contain no provider credentials: the storefront only knows
  provider names and display data from `GET /payments/providers`.

## Callback handling

Callbacks are public endpoints and are treated as untrusted:

1. The provider adapter parses the payload; malformed payloads yield
   `authority = null` and are redirected to the failure page
   (`reason=PAYMENT_NOT_FOUND`).
2. The attempt is located by `provider + providerAuthority`; the `paymentId`
   hint in the callback URL must agree, otherwise the callback is rejected
   (`TRANSACTION_MISMATCH`) and the attempt is left untouched.
3. Amounts echoed by the provider must match the stored attempt amount
   (`AMOUNT_MISMATCH` → failed, order stays unpaid).
4. `status=OK` from the browser is never proof: the backend always calls the
   provider's verify endpoint. Only a provider-confirmed result marks the
   attempt `PAID`; a provider-confirmed amount that differs from ours fails
   the attempt and is logged at error level for manual handling.
5. Re-verification of an already-verified transaction (e.g. ZarinPal code
   101) is accepted as paid but never double-finalizes: the claim step
   guarantees a single finalization.
6. Callback responses are `303` redirects only; nothing about the outcome is
   trusted from the URL on the result pages, which query
   `GET /payments/:id`.

Callbacks are exempt from the CSRF header requirement because they are
unauthenticated and change no state without provider verification.

## Authorization

Granular permissions (`rbac/permissions.ts`): `payment_gateway.view`,
`payment_gateway.update`, `payment_gateway.test`, `payment.view`,
`payment.refund`, `payment.reconcile`. `ADMIN` gets view/reconcile by default;
update/test/refund are reserved for `SUPER_ADMIN` unless granted explicitly.
Customers can only read their own attempts (`userId` scoped queries).

## Production safeguards

- Enabling a provider in `PRODUCTION`, switching to `PRODUCTION`, or changing
  credentials while live requires `confirmProduction: true`
  (`PAYMENT_GATEWAY_CONFIRM_PRODUCTION`).
- The mock provider is refused in production regardless of configuration.
- Admin test payments are only issued in `SANDBOX`; a production test would
  create a real transaction.
- Adapters whose endpoints are unverified refuse `createPayment` until
  `contractDocsConfirmed=yes` is set by an operator.

## Logging and audit

- Provider calls log `{provider, operation, host, status, durationMs}` only.
  Bodies, headers, tokens and credentials are never logged.
- Ledger payloads (`payment_transactions.payload`) and audit metadata pass
  through `redactSecrets` (keys matching password/secret/token/key/credential/
  authorization are replaced).
- Audited actions: `payment_gateway.update` (with a redacted change list),
  `payment_gateway.test`, `payment_gateway.test_payment`, `payment.reconcile`,
  `payment.refund`, `order.status.update`, `order.shipment.create`.

## Transport

- HTTPS in production is enforced by the Nginx front (see DEPLOYMENT.md);
  gateway callbacks must be registered with the public HTTPS URL.
- Provider HTTP calls use a 15 s timeout and do not follow redirects.
- Global rate limiting applies to callback endpoints; authentication
  endpoints keep their stricter limits.
