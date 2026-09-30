# Payment reconciliation

## What can go wrong

| Situation | Resulting state | Recovery |
| --- | --- | --- |
| Customer closes the gateway page | attempt `REDIRECTED`, order `PENDING_PAYMENT` | Customer retries from `/account/orders/<id>` (same attempt is resumed) or the order expires |
| Callback lost (network) but customer paid | attempt `REDIRECTED` | Customer presses "بررسی وضعیت" (`POST /payments/:id/verify`) or admin runs **Reconcile**; the provider verify confirms and finalizes |
| Provider verify timed out | attempt `CALLBACK_RECEIVED` | Duplicate callback or **Reconcile** retries verification |
| Order expired, then the gateway confirms payment | attempt `PAID` with `errorCode=ORDER_NOT_PENDING`, order `CANCELLED` | Admin **Refund** (order → `REFUNDED`); stock was already released |
| Provider confirms a different amount | attempt `FAILED` `AMOUNT_MISMATCH`, order unpaid | Manual: check the provider panel, refund there if money was captured |
| Settlement (BNPL) failed after verify | attempt `PAID`, ledger `SETTLEMENT` failed | **Reconcile** or provider panel; order stays paid |

Unpaid orders are cancelled by `OrdersScheduler` every minute once
`paymentDeadlineAt` passes; their open attempts become `EXPIRED` and reserved
stock is released.

## Admin reconcile (`POST /admin/payments/:id/reconcile`)

1. If the adapter supports `inquiry`, the provider is asked for the
   transaction status and an `INQUIRY` ledger row is written.
2. If the provider reports `PAID`, or the attempt is still open and the
   provider is undecided, a server-side verify runs through the normal claim
   path (`FAILED` attempts may be re-claimed here). Only a provider `PAID`
   answer finalizes the order.
3. If the provider reports `FAILED` and the attempt is open, it is marked
   `FAILED` (`RECONCILED_FAILED`).
4. The response carries `providerStatus`, `changed` and a message. The action
   is audited.

Reconciliation can never mark a payment paid without the provider's own
confirmation.

## Refund (`POST /admin/payments/:id/refund`)

Allowed when the attempt is `PAID` and the order is `CANCELLED` or `RETURNED`
(or the attempt is flagged `ORDER_NOT_PENDING`). The adapter's `refund` or
`reverse` capability is used; a `REFUND`/`REVERSE` ledger row is written, the
attempt becomes `REFUNDED` and the order moves to `REFUNDED`. Providers
without an API refund raise `REFUND_NOT_SUPPORTED`; refund through the
provider panel and record the order status manually.

## Inspecting a payment

`GET /admin/payments/:id` returns the attempt, the customer, the order status,
the full provider ledger (`transactions`) and the redacted callback and
verification payloads. `GET /admin/payments?search=` matches order numbers,
authorities, provider references and customer email/phone.

## Provider-specific notes

- **ZarinPal**: `inquiry.json` gives a session status; `unVerified.json`
  (not yet exposed in the UI) lists paid-but-unverified authorities and can
  be used to recover lost callbacks in bulk. Verify returns `101` for already
  verified sessions, so re-verification is safe.
- **DigiPay**: a purchase can be reversed within 25 minutes of confirmation
  (official snippet); later refunds follow the provider's refund API, which
  is unverified.
- **SnappPay / TorobPay**: settle and revert contracts are unverified; use the
  merchant portals until the contract documentation is confirmed.
