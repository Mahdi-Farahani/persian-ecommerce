# ZarinPal

Adapter: `apps/api/src/payments/providers/zarinpal.provider.ts`
Research evidence: [research/ZARINPAL.md](./research/ZARINPAL.md)

## Official documentation source

- https://www.zarinpal.com/docs/ (primary; unreachable from the build
  environment on the review date, search-engine excerpts only)
- Official SDK sources, read in full: https://github.com/ZarinPal/ZarinPal-node-SDK,
  https://github.com/ZarinPal/zarinpal-php-sdk, https://github.com/ZarinPal-Lab/Zarinpal-RestAPI-Sample-php
  (GitHub-verified organisations)

## Last documentation review date

2026-09-30

## Authentication

`merchant_id` (UUID) in the JSON body of every REST v4 call. No HTTP auth
header, signature or IP whitelist is documented for REST v4. The GraphQL API
(refund listing/creation) needs a Bearer access token and is **not** used by
this adapter.

## Endpoints

| Operation | Method/URL |
| --- | --- |
| Create | `POST {base}/pg/v4/payment/request.json` |
| Redirect | `GET {base}/pg/StartPay/{authority}` |
| Verify | `POST {base}/pg/v4/payment/verify.json` |
| Reverse | `POST {base}/pg/v4/payment/reverse.json` |
| Inquiry | `POST {base}/pg/v4/payment/inquiry.json` |
| Fee calculation (connection test) | `POST {base}/pg/v4/payment/feeCalculation.json` |

## Sandbox

`https://sandbox.zarinpal.com`; any UUID is accepted as merchant id;
authorities start with `S`. Status: IMPLEMENTED.

## Production

`https://payment.zarinpal.com` by default (configurable setting
`productionBaseUrl`, because official sources also show `api.zarinpal.com`
and `www.zarinpal.com`). Status: IMPLEMENTED, REQUIRES PRODUCTION CREDENTIALS.

## Create payment

Body: `merchant_id`, `amount` (integer in the configured unit), `currency`
(`IRR` default or `IRT`), `callback_url` (our callback with `?paymentId=`),
`description`, `metadata { order_id, mobile?, email? }` (mobile only when it
matches `09XXXXXXXXX`). Success `data.code = 100` with `data.authority`; the
customer is redirected to StartPay.

## Callback

GET to `callback_url` with `Authority` and `Status=OK|NOK`. `NOK` covers both
cancellation and failure. Authority must match `^[AS][0-9a-zA-Z]{35}$`.

## Verification

Body `merchant_id`, `amount` (same unit as the request), `authority`.
`code 100` → paid (`ref_id`, `card_pan`, `card_hash`, `fee`), `code 101` →
already verified (treated as paid, `alreadyVerified=true`, never
double-finalized). Any other code or an `errors` envelope → failed with the
provider code preserved.

## Settlement

None; verify is the capture. Status: NOT SUPPORTED BY PROVIDER (not needed).

## Refund/reverse

- Reverse (`reverse.json`, `merchant_id + authority`): IMPLEMENTED as the
  adapter's refund capability. Eligibility window and state constraints are
  not documented publicly.
- Refund via GraphQL `AddRefund` (needs access token and a `session_id`
  whose lookup is unverified): NOT IMPLEMENTED (UNVERIFIED).

## Error codes

Verified: `100` success, `101` already verified. Snippet: `-51` session not
paid. The complete table lives on the (blocked) error-list page; the adapter
keeps unknown codes as `providerCode` and maps them to `PROVIDER_REJECTED`.
Codes `-74`/`-80` are mapped to `INVALID_CREDENTIALS` as a best effort
(UNVERIFIED).

## Required credentials

| Field | Admin label | Notes |
| --- | --- | --- |
| `merchantId` | Merchant ID | UUID, masked in API responses |

## Environment variables

`ZARINPAL_ENABLED`, `ZARINPAL_ENVIRONMENT` (`SANDBOX`/`PRODUCTION`),
`ZARINPAL_DEFAULT`, `ZARINPAL_MERCHANT_ID`, `ZARINPAL_CURRENCY`,
`ZARINPAL_PRODUCTION_BASE_URL` (bootstrap only).

## Admin configuration

Enable/disable, default, environment, Merchant ID, currency unit, production
base URL, "Test connection" (fee calculation, no transaction), "Test payment"
(sandbox only).

## Known limitations

- Error-code texts, callback URL constraints, verify time limits and reverse
  eligibility are not verified (docs pages blocked).
- Field placement of `mobile`/`email`/`order_id` (inside `metadata` vs top
  level) differs between official SDKs; the adapter uses `metadata` as the
  Lab sample and docs snippet do.
- `unVerified.json` is not yet exposed for bulk recovery.

## Implementation notes

- Amount unit conversion happens in `amount.util.ts`; the same unit is used
  for request and verify.
- Inquiry statuses other than `VERIFIED` are mapped conservatively
  (`PAID` → pending re-verify, `FAILED/REVERSED/EXPIRED/TRASH` → failed).
- Unit tests: `providers/zarinpal.provider.spec.ts` (contract suite with the
  verified JSON shapes).

## Verification checklist

- [x] Official docs located (GitHub-verified SDK sources; docs site blocked)
- [x] Authentication verified (merchant_id in body)
- [x] Create-payment API verified (request.json, StartPay)
- [x] Callback verified (GET Authority/Status)
- [x] Verification API verified (verify.json, 100/101)
- [x] Amount/currency verified (integer, IRR/IRT)
- [ ] Error codes verified (only 100/101 verified, -51 snippet)
- [x] Sandbox verified (sandbox.zarinpal.com)
- [x] Production endpoint verified (payment.zarinpal.com per SDK)
- [x] Required credentials verified (merchant_id)
- [x] Refund/reverse capability verified (reverse.json; GraphQL refund not implemented)
- [x] Implementation matches docs (for the verified surface)
- [x] Tests added

Status: IMPLEMENTED (sandbox and production); production use REQUIRES
PRODUCTION CREDENTIALS and a live re-check of the error-code table.
