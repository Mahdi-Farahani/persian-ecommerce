# Payment architecture

## Layers

```
Storefront checkout
      │  POST /checkout            → order PENDING_PAYMENT, stock reserved
      │  POST /payments            → payment attempt, redirect to gateway
      ▼
PaymentsService                     apps/api/src/payments/payments.service.ts
      │  create / handleCallback / verify / finalize / refund / reconcile
      ▼
ProviderRegistryService             DB-backed registry, encrypted credentials
PaymentProviderFactory              ProviderContext → adapter instance
      ▼
PaymentProvider adapters            providers/{zarinpal,snapppay,digipay,torobpay,mock}.provider.ts
      ▼
ProviderHttpClient                  fetch wrapper: timeouts, JSON, redacted logs
```

`OrdersService` owns the order state machine (`orders/order-status.ts`) and
inventory side effects; `PaymentsService` calls `OrdersService.transition`
inside its own transaction when a payment is confirmed.

## Adapter contract

`payment-provider.types.ts` defines:

- `ProviderDefinition` – display data, credential and setting fields (rendered
  dynamically by the admin UI), capabilities, sandbox support, docs status,
  minimum amount.
- `createPayment(request) → { authority, redirectUrl, redirectMethod, redirectFields? }`
- `parseCallback(payload) → { authority, outcome, amount?, reference?, raw }` –
  pure and never throws; the outcome is a hint only.
- `verifyPayment(request) → PAID | FAILED | PENDING`
- optional `settlePayment`, `refundPayment`, `inquirePayment`
- `testConnection()` for the admin "Test connection" button.

Adapters throw `PaymentProviderError` (normalized `code` + raw `providerCode`)
for transport, credential or configuration failures and return `FAILED`
results for business declines.

## Amounts

Internal amounts are integer IRR (`BigInt` in the database). `amount.util.ts`
converts to a provider unit (`IRR` or `IRT`) and back; conversion is the only
place where the unit changes, and toman conversion refuses amounts that are
not multiples of 10.

## Payment attempt lifecycle

```
INITIATED ──create ok──▶ REDIRECTED ──callback──▶ CALLBACK_RECEIVED ──claim──▶ VERIFYING
    │                        │                                                   │
    └──create failed──▶ FAILED                                     ┌─────────────┼──────────────┐
                             │                                     ▼             ▼              ▼
                     (order expiry) ▶ EXPIRED                    PAID          FAILED       CANCELLED
                                                                   │
                                                          admin refund ▶ REFUNDED
```

One order can hold many attempts (`payments.attemptNumber`, unique per order).
Creating a payment resumes an open attempt on the same provider; picking a
different provider supersedes the open one (`errorCode = SUPERSEDED`).

## Idempotency

| Operation | Mechanism |
| --- | --- |
| create | open attempt is reused; unique `(orderId, attemptNumber)`; per-attempt `requestId` (UUID) sent to providers that support idempotency keys |
| callback | located by `provider + providerAuthority` (hint `paymentId` cross-checked → `TRANSACTION_MISMATCH` on disagreement); `callbackAt` set once; terminal attempts only redirect |
| verify | single claim `UPDATE … WHERE status IN (INITIATED, REDIRECTED, CALLBACK_RECEIVED, EXPIRED) SET VERIFYING`; the loser reads the current row |
| finalize | one transaction: payment PAID + ledger row + order `PENDING_PAYMENT → PAID` (stock committed) |
| refund | only from PAID; ledger row written before the state change |

Provider/network errors during verification release the claim
(`CALLBACK_RECEIVED`) so a duplicate callback or an admin reconciliation can
retry.

## Order finalization

`PaymentsService.finalize` runs in one Prisma transaction:

1. payment → `PAID`, `verifiedAt`, `providerTransactionId`, masked PAN,
   verification payload;
2. `payment_transactions` row (`PAYMENT`, succeeded);
3. `OrdersService.transition(PENDING_PAYMENT → PAID)` which commits the stock
   reservation and appends order history.

If the order is no longer `PENDING_PAYMENT` (expired/cancelled before a late
callback) the payment is still recorded as `PAID` with
`errorCode = ORDER_NOT_PENDING`; stock is not re-reserved and the admin refund
flow returns the money (see PAYMENT-RECONCILIATION.md).

BNPL providers with a `settle` capability are settled right after
finalization; a failed settlement is logged in the ledger and left for
reconciliation, the order stays paid.

## Registry

`payment_provider_configs` holds one row per provider (created on boot):
`enabled`, `isDefault` (at most one), `environment`, encrypted credentials,
JSON settings, last test result. Environment variables seed a row only when
it is first created. The checkout endpoint `GET /payments/providers` lists
enabled providers the runtime allows (mock only outside production; adapters
without verified docs only when `contractDocsConfirmed=yes`). No silent
fallback: a disabled default yields `PAYMENT_PROVIDER_UNAVAILABLE`.

## HTTP API

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/payments/providers` | public | providers for checkout |
| POST | `/payments` | user | create/resume attempt `{orderId, provider?}` |
| GET | `/payments/:id` | owner | attempt view (result pages) |
| GET | `/payments/:id/status` | owner | status only |
| POST | `/payments/:id/verify` | owner | re-verify after lost callback |
| GET/POST | `/payments/:slug/callback` | public | provider callback → 303 |
| GET | `/payments/mock/gateway` | public (dev) | mock gateway page |
| GET | `/admin/payment-gateways` | `payment_gateway.view` | masked registry |
| PATCH | `/admin/payment-gateways/:provider` | `payment_gateway.update` | update (audited) |
| POST | `/admin/payment-gateways/:provider/test` | `payment_gateway.test` | connection test |
| POST | `/admin/payment-gateways/:provider/test-payment` | `payment_gateway.test` | sandbox-only test request |
| GET | `/admin/payments`, `/admin/payments/:id` | `payment.view` | attempts + ledger |
| POST | `/admin/payments/:id/reconcile` | `payment.reconcile` | provider inquiry + sync |
| POST | `/admin/payments/:id/refund` | `payment.refund` | refund/reverse |

## Adding a provider

1. Implement `PaymentProvider` in `providers/<name>.provider.ts` with an
   exported `*_DEFINITION`.
2. Register the definition in `provider-definitions.ts` and the constructor
   in `payment-provider.factory.ts`.
3. Run the contract suite (`providers/provider-contract.suite.ts`) for it.
4. Document it under `docs/payments/<NAME>.md` with the verification checklist.
