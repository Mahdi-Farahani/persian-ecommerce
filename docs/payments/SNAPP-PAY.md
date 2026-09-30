# SnappPay (اسنپ‌پی) — adapter documentation

Adapter: `apps/api/src/payments/providers/snapp-pay.provider.ts` (`SNAPP_PAY_DEFINITION`, `SnappPayPaymentProvider`), built on `bnpl-token.provider.base.ts`.
Research notes with the evidence table: `docs/payments/research/SNAPPPAY.md`.

> **Go-live requires confirming this adapter against the documentation delivered with the merchant contract.** SnappPay publishes no developer documentation; it is handed to merchants after contract approval (academy SNIPPET). No base URL is public, so the adapter cannot run at all until an operator enters the URLs. Every path and field name is UNVERIFIED and configurable. Payment creation is blocked until «تأیید مطابقت با مستندات قرارداد» (`contractDocsConfirmed`) is `yes`.

## Official documentation source

| Source           | URL                                                        | Status on review date             |
| ---------------- | ---------------------------------------------------------- | --------------------------------- |
| Corporate site   | https://snapppay.ir/                                       | Unreachable (HTTP 403)            |
| Merchant portal  | https://portal.snapppay.ir/                                | Unreachable                       |
| Merchant academy | https://academy.snapppay.ir/                               | Unreachable; search excerpts only |
| Developer docs   | none exists publicly (`docs.snapppay.ir` does not resolve) | —                                 |
| GitHub org       | https://github.com/snapppay                                | Exists, no public repositories    |

`docsStatus` in the adapter definition: **UNVERIFIED**.

## Last documentation review date

2026-09-30

## Authentication

- Model (UNVERIFIED, third-party packages only): OAuth2 password grant — `POST {base}/{tokenPath}` with form body `grant_type=password&username=…&password=…` and `Authorization: Basic base64(clientId:clientSecret)`; the returned `access_token` is sent as `Authorization: Bearer …`.
- Token lifetime/refresh: UNVERIFIED. The adapter memoizes the token per instance (honouring `expires_in` minus 30 s), refreshes once and retries once on HTTP 401, and maps 401/403 (or 400 `invalid_grant`/`invalid_client`) on the token call to `INVALID_CREDENTIALS`.

## Endpoints

All paths are admin settings; defaults are the names reported by third-party packages (UNVERIFIED). A path may be an absolute URL (e.g. a separate auth host).

| Operation                                    | Method      | Default path (setting)                                                               |
| -------------------------------------------- | ----------- | ------------------------------------------------------------------------------------ |
| Token                                        | POST (form) | `api/online/v1/oauth/token` (`tokenPath`)                                            |
| Create payment token                         | POST (JSON) | `api/online/payment/v1/token` (`paymentTokenPath`)                                   |
| Verify                                       | POST (JSON) | `api/online/payment/v1/verify` (`verifyPath`)                                        |
| Settle                                       | POST (JSON) | `api/online/payment/v1/settle` (`settlePath`)                                        |
| Revert                                       | POST (JSON) | `api/online/payment/v1/revert` (`revertPath`)                                        |
| Eligibility (`api/online/offer/v1/eligible`) | —           | not implemented (no place in the provider interface; add at checkout when confirmed) |
| Status / update / cancel                     | —           | not implemented (not even named in any reachable source)                             |

## Sandbox

- `supportsSandbox: false` — the existence of a sandbox is UNVERIFIED; the academy implies acceptance is done with a real test order of at least 100,000 toman.
- `sandboxBaseUrl` defaults to empty. If SnappPay provides a test host, enter it and the adapter will use it when the environment is SANDBOX (the admin UI still refuses SANDBOX for this provider until `supportsSandbox` is flipped in code once confirmed).

## Production

- `productionBaseUrl` defaults to **empty**; `createPayment`/`testConnection` throw `MISCONFIGURED` until it is set.
- Enabling in production requires the explicit production confirmation plus `contractDocsConfirmed = yes`.
- Minimum amount enforced for admin test payments: 1,000,000 IRR (100,000 toman, academy SNIPPET).

## Create payment

`createPayment` → `POST {base}/api/online/payment/v1/token` with bearer token. Body (all UNVERIFIED):

| Field           | Value                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| `amount`        | integer in `amountUnit` (IRR default, IRT ÷10)                             |
| `mobile`        | customer mobile when known                                                 |
| `returnURL`     | our callback URL                                                           |
| `transactionId` | our payment attempt id (`paymentId`)                                       |
| `cartList`      | `[{ cartId: orderNumber, totalAmount, items: [{ name, count, amount }] }]` |

Expected response envelope (UNVERIFIED): `{ successful: true, response: { paymentToken, paymentPageUrl } }`; the adapter also accepts `token` / `paymentUrl` / `redirectUrl`. `paymentToken` is stored as the authority; the customer is redirected (GET) to `paymentPageUrl`. `{ successful: false, errorData: { errorCode, message } }` → `PROVIDER_REJECTED`.

## Callback

- Method and parameters UNVERIFIED. The adapter merges the POST body over the GET query and reads `paymentToken`/`token` → `authority`, `transactionId` → `reference`, `state`/`status`/`result` → outcome (`OK`/`SUCCESS`/`PAID`… → OK; `FAILED`/`NOK`/`ERROR`/`EXPIRED`… → FAILED; `CANCEL(L)ED` → CANCELLED; else UNKNOWN), and `amount` (converted to IRR) when present.
- `parseCallback` never throws; unrecognized payloads yield `authority: null, outcome: 'UNKNOWN'`.

## Verification

`POST {base}/api/online/payment/v1/verify` with `{ paymentToken }` (UNVERIFIED).

- `successful: true` → `PAID` with `providerTransactionId = response.transactionId ?? paymentToken`, `amount` converted to IRR when echoed, `cardPanMask: null`. `alreadyVerified` is `true` only when the response status word contains already/duplicate/verified.
- `successful: false` → `FAILED` with `errorData.errorCode`/`message` (a duplicate verify is expected to land here).
- A `response.status` failure word → `FAILED`.
- HTTP 5xx → `PROVIDER_UNAVAILABLE` (retryable); credential/transport problems throw.

## Settlement

BNPL capture step. `settlePayment` → `POST {base}/api/online/payment/v1/settle` with `{ paymentToken }` (UNVERIFIED). The platform calls it automatically after a successful verify and records the outcome as a `SETTLEMENT` transaction; failures are logged for reconciliation. Capability declared: `settle`. Window, idempotency and partial settle: UNVERIFIED.

## Refund/reverse

`refundPayment` → `POST {base}/api/online/payment/v1/revert` with `{ paymentToken, amount, description }` (UNVERIFIED). Whether revert is allowed after settlement is NOT DOCUMENTED. Capability declared: `refund`.

## Error codes

NOT AVAILABLE — no code table exists in any reachable source. The adapter surfaces `errorData.errorCode` and `message` verbatim; nothing is hard-coded.

## Required credentials

All secret, all required; names are those reported by research and must be matched to the credentials SnappPay issues.

| Key            | Label                      | Use                                   |
| -------------- | -------------------------- | ------------------------------------- |
| `clientId`     | شناسهٔ کلاینت (Client ID)  | HTTP Basic user on the token call     |
| `clientSecret` | رمز کلاینت (Client Secret) | HTTP Basic password on the token call |
| `username`     | نام کاربری پذیرنده         | password-grant username               |
| `password`     | رمز عبور پذیرنده           | password-grant password               |

## Environment variables

Bootstrap only; prefix `SNAPP_PAY`.

```text
SNAPP_PAY_ENABLED=true|false
SNAPP_PAY_ENVIRONMENT=PRODUCTION
SNAPP_PAY_DEFAULT=true|false
SNAPP_PAY_CLIENT_ID=
SNAPP_PAY_CLIENT_SECRET=
SNAPP_PAY_USERNAME=
SNAPP_PAY_PASSWORD=
SNAPP_PAY_CONTRACT_DOCS_CONFIRMED=no|yes
SNAPP_PAY_AMOUNT_UNIT=IRR|IRT
SNAPP_PAY_PRODUCTION_BASE_URL=        # required; not published
SNAPP_PAY_SANDBOX_BASE_URL=           # only if SnappPay provides one
SNAPP_PAY_TOKEN_PATH=api/online/v1/oauth/token
SNAPP_PAY_PAYMENT_TOKEN_PATH=api/online/payment/v1/token
SNAPP_PAY_VERIFY_PATH=api/online/payment/v1/verify
SNAPP_PAY_SETTLE_PATH=api/online/payment/v1/settle
SNAPP_PAY_REVERT_PATH=api/online/payment/v1/revert
```

## Admin configuration

Admin → تنظیمات → درگاه‌های پرداخت → اسنپ‌پی:

1. Enter the four credentials from the merchant contract.
2. Enter «آدرس پایهٔ عملیاتی» (mandatory — no default exists).
3. Compare every path setting with the contract documentation and correct as needed.
4. Choose «واحد مبلغ ارسالی».
5. Run «آزمون اتصال» (token exchange only; the message warns while contract docs are unconfirmed).
6. Set «تأیید مطابقت با مستندات قرارداد» to «بله».
7. Enable (production confirmation required).

## Known limitations

- No public documentation: every endpoint, field, code and the callback contract are assumptions.
- No eligibility check before showing the option at checkout.
- No status/inquiry endpoint; reconciliation relies on verify.
- Duplicate verification is surfaced as `FAILED` with the provider's code unless the provider marks it in a status word.
- Partial settle/refund unsupported.
- Sandbox unknown (`supportsSandbox: false`).

## Implementation notes

- Shared flow with TorobPay in `BnplTokenProviderBase`: token → payment token → hosted page → verify → settle, plus revert/status.
- Provider payloads are parsed from a redacted copy: credential-like keys are removed and strings containing a credential value are replaced, so `raw` and error messages never contain secrets or tokens.
- Cart item amounts use the same unit conversion as the total; with IRT every price must be a multiple of 10 rials.
- Adapter instances are created per operation, so the token memo is short-lived by design.

## Verification checklist

Copied from research §13; status vocabulary: IMPLEMENTED / NOT SUPPORTED BY PROVIDER / NOT AVAILABLE IN SANDBOX / REQUIRES PRODUCTION CREDENTIALS / UNVERIFIED.

- [ ] Any base URL (production or sandbox). — Status: UNVERIFIED (must be entered; configurable IMPLEMENTED)
- [ ] Authentication credentials, token endpoint, grant type, token lifetime. — Status: UNVERIFIED (password grant + bearer IMPLEMENTED)
- [ ] All endpoint paths and HTTP methods. — Status: UNVERIFIED (configurable paths IMPLEMENTED)
- [ ] Request/response schemas for eligibility, token, verify, settle, revert, status, update, cancel. — Status: UNVERIFIED (token/verify/settle/revert IMPLEMENTED with assumed schema; eligibility/status/update/cancel not implemented)
- [ ] Amount unit (IRR vs toman) and minimum/maximum amounts. — Status: UNVERIFIED (unit configurable; 100,000-toman test-order minimum applied)
- [ ] Callback method and parameter names; cancel signalling. — Status: UNVERIFIED (tolerant GET/POST parsing IMPLEMENTED)
- [ ] Error codes. — Status: UNVERIFIED
- [ ] Signature/IP-whitelist requirements. — Status: UNVERIFIED
- [ ] Refund support after settlement. — Status: UNVERIFIED
- [ ] Whether a sandbox environment exists. — Status: UNVERIFIED / REQUIRES PRODUCTION CREDENTIALS

Go-live rule: none of the boxes above may remain unchecked for an enabled production gateway; confirm each item against the contract-supplied documentation, correct the settings, then set `contractDocsConfirmed = yes`.
