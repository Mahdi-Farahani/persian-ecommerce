# Payments

Provider-agnostic payment layer for the Persian e-commerce platform. Business
code (checkout, orders) never talks to a gateway directly; it talks to
`PaymentsService`, which selects an adapter through `PaymentProviderFactory`.

| Document | Purpose |
| --- | --- |
| [PAYMENT-ARCHITECTURE.md](./PAYMENT-ARCHITECTURE.md) | Flow, states, idempotency, code map |
| [PAYMENT-SECURITY.md](./PAYMENT-SECURITY.md) | Credential encryption, callback validation, RBAC, logging |
| [PAYMENT-RECONCILIATION.md](./PAYMENT-RECONCILIATION.md) | Lost callbacks, inquiry, refunds, manual procedures |
| [ZARINPAL.md](./ZARINPAL.md) | ZarinPal REST v4 adapter (partially verified against official sources) |
| [SNAPP-PAY.md](./SNAPP-PAY.md) | SnappPay BNPL adapter (official docs not public) |
| [DIGIPAY.md](./DIGIPAY.md) | DigiPay UPG adapter (official page confirmed, content unreadable) |
| [TOROB-PAY.md](./TOROB-PAY.md) | TorobPay BNPL adapter (official docs not public) |
| [research/](./research) | Raw research notes with evidence levels (VERIFIED / SNIPPET / UNVERIFIED) |

## Provider status at a glance

| Provider | Docs status | Checkout ready | Sandbox | Refund via API |
| --- | --- | --- | --- | --- |
| ZarinPal | PARTIAL (SDK sources verified, docs pages blocked) | Yes, after credentials are entered | Yes | Reverse (`reverse.json`); GraphQL refund not implemented |
| SnappPay | UNVERIFIED | Only after `contractDocsConfirmed=yes` | No public sandbox | Revert (unverified) |
| DigiPay | PARTIAL | Only after `contractDocsConfirmed=yes` | UAT host reported (unverified) | Reversal window 25 min (snippet) |
| TorobPay | UNVERIFIED | Only after `contractDocsConfirmed=yes` | None known | Plugin advertises refunds (unverified) |
| Mock | n/a | Dev/test only (`PAYMENT_MOCK_ENABLED=true`, refused in production) | n/a | Simulated |

"Checkout ready" means the adapter accepts `createPayment`. Providers whose
documentation could not be verified refuse to create payments until an
operator confirms the endpoints against the documentation delivered with the
merchant contract (admin setting `contractDocsConfirmed`).

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `PAYMENT_ENCRYPTION_KEY` | yes | ≥32 chars; AES-256-GCM key for credentials at rest (64 hex, base64url of 32 bytes, or a passphrase that is hashed) |
| `API_PUBLIC_URL` | no | Absolute API base reachable by gateways for callbacks; defaults to `APP_URL/api/v1` |
| `ORDER_PAYMENT_TIMEOUT_MINUTES` | no (30) | Unpaid orders are cancelled and their stock released after this |
| `PAYMENT_MOCK_ENABLED` | no (false) | Allows the mock gateway (refused when `NODE_ENV=production`; a local Compose stack sets `API_NODE_ENV=development`) |
| `PAYMENT_MOCK_DEFAULT` | no (false) | Bootstrap: make the mock gateway the checkout default on first boot |
| `<PREFIX>_ENABLED`, `<PREFIX>_ENVIRONMENT`, `<PREFIX>_DEFAULT`, `<PREFIX>_<FIELD>` | no | Bootstrap values for a provider, applied only when its registry row is first created. Prefixes: `ZARINPAL`, `SNAPP_PAY`, `DIGIPAY`, `TOROB_PAY`, `PAYMENT_MOCK`. `<FIELD>` is the credential/setting key in UPPER_SNAKE (e.g. `ZARINPAL_MERCHANT_ID`, `ZARINPAL_CURRENCY`) |

Environment variables are bootstrap defaults. After first boot the admin panel
(`/admin/settings/payment-gateways`) is the source of truth.

## Callback URLs to register with providers

```
<API_PUBLIC_URL>/payments/zarinpal/callback
<API_PUBLIC_URL>/payments/snapp-pay/callback
<API_PUBLIC_URL>/payments/digipay/callback
<API_PUBLIC_URL>/payments/torob-pay/callback
```

They accept GET and POST and always answer with a `303` redirect to the
storefront result page (`/payment/success|failure|pending?paymentId=…`), which
then asks the backend for the authoritative status.
