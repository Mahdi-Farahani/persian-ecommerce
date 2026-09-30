# ZarinPal — Payment Gateway Integration Reference (research)

Research date: 2026-09-30. Evidence levels used in this document:

- **VERIFIED** — read directly from an official ZarinPal source (official GitHub orgs `ZarinPal` and `ZarinPal-Lab`, both carrying GitHub's "Verified: controls www.zarinpal.com" badge).
- **SNIPPET** — text of an official `zarinpal.com/docs` page as returned by a search-engine excerpt; the page itself could not be opened from this environment.
- **UNVERIFIED** — not confirmed by any official source reachable today. Do not implement against it without confirming.

## 1. Official documentation sources

| Source | URL | Reachable on 2026-09-30? |
|---|---|---|
| Official docs site (primary) | https://www.zarinpal.com/docs/ | NO — blocked by the network egress policy (HTTP 403 on CONNECT). Only search-engine excerpts of individual pages were available. |
| Official docs (alternate host) | https://docs.zarinpal.com/ | NO — blocked (403). |
| Gateway guide page | https://www.zarinpal.com/docs/paymentGateway/connectToGateway | NO (SNIPPET only) |
| Error list page | https://www.zarinpal.com/docs/paymentGateway/errorList (also cited as https://www.zarinpal.com/docs/md/paymentGateway/errorList.html and https://docs.zarinpal.com/paymentGateway/error.html) | NO (page title confirmed by search index; table content not retrievable) |
| Sandbox page | https://www.zarinpal.com/docs/paymentGateway/sandBox | NO (SNIPPET only) |
| Verify (PHP SDK method page) | https://www.zarinpal.com/docs/sdk/php/method/verify | NO (SNIPPET only) |
| Unverified (SDK method page) | https://www.zarinpal.com/docs/sdk/php/method/unVerified , https://www.zarinpal.com/docs/sdk/nodejs/method/unVerified | NO (title only) |
| Refund (PHP SDK method page) | https://www.zarinpal.com/docs/sdk/php/method/refund | NO (SNIPPET only) |
| API (GraphQL) auth page | https://www.zarinpal.com/docs/apiDocs/auth , https://www.zarinpal.com/docs/apiDocs/ | NO (SNIPPET only) |
| Official GitHub org (SDKs) | https://github.com/ZarinPal | YES (VERIFIED badge for www.zarinpal.com) |
| Official Node SDK source | https://github.com/ZarinPal/ZarinPal-node-SDK (branch `main`, files `src/Zarinpal.ts`, `src/resources/*.ts`, `src/utils/Validator.ts`) | YES — read in full |
| Official PHP SDK source | https://github.com/ZarinPal/zarinpal-php-sdk (branch `main`, `src/**`, `examples/*.php`) | YES — read in full |
| Official Python SDK | https://github.com/ZarinPal/Zarinpal-Python-Sdk | YES (README summary only) |
| Official Lab org | https://github.com/ZarinPal-Lab (VERIFIED badge for www.zarinpal.com) | YES |
| Official REST v4 PHP sample | https://github.com/ZarinPal-Lab/Zarinpal-RestAPI-Sample-php (`Request.php`, `Verification.php`, branch `master`) | YES — read in full |
| Legacy official PDF (v1.2, April 2014, SOAP era) | https://github.com/ZarinPal-Lab/Documentation-PaymentGateway (`Doc-English.pdf`) | YES — read in full; **obsolete** (SOAP `PaymentRequest`/`PaymentVerification`), used only for historical context |
| Legacy REST v3 blueprint | https://github.com/ZarinPal-Lab/API-Docs (`index.apib`, `HOST: https://api.zarinpal.com/rest/v3`) | YES — covers cards/purses/webservices, **not** the v4 gateway; not used |

## 2. Authentication

- **`merchant_id`** (VERIFIED) — a UUID (regex enforced by both official SDKs: `^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$`). Sent in the JSON body of every REST v4 call. No HTTP auth header is used for the REST payment endpoints (VERIFIED from `Zarinpal.ts`: the SDK injects `merchant_id` into the body of every request).
- **`access_token`** (VERIFIED naming from SDK config: Node `accessToken`, PHP option `access_token`, env `ZARINPAL_ACCESS_TOKEN`) — used only for the GraphQL API (refunds, transaction listing). Sent as `Authorization: Bearer <token>` to `https://next.zarinpal.com/api/v4/graphql/` (VERIFIED in `Zarinpal.ts` and `BaseGraphQLService.php`). The PHP example comments: "Access token بدون Bearer" (store the raw token; SDK adds the `Bearer ` prefix).
- How the access token is obtained (SNIPPET of https://www.zarinpal.com/docs/apiDocs/auth): ZarinPal's API uses "OAuth 2.0 protocol and GraphQL"; after a password-based authentication flow "an Access Token and a Refresh Token are sent", `token_type` = `Bearer`. Search excerpts of the WooCommerce plugin page say the token comes from "your ZarinPal developer panel". **Exact issuance endpoint, scopes, lifetime and refresh flow: UNVERIFIED.**
- IP whitelist: not present in any current official source read (the 2014 PDF mentions acceptor IP; treat as obsolete). **UNVERIFIED for v4.**

## 3. Environments

| | Production | Sandbox |
|---|---|---|
| REST base (VERIFIED, both SDKs) | `https://payment.zarinpal.com` | `https://sandbox.zarinpal.com` |
| REST base used by ZarinPal-Lab sample (VERIFIED) | `https://api.zarinpal.com` (`/pg/v4/payment/request.json`, `/pg/v4/payment/verify.json`) | — |
| StartPay (VERIFIED, SDKs) | `https://payment.zarinpal.com/pg/StartPay/{authority}` | `https://sandbox.zarinpal.com/pg/StartPay/{authority}` |
| StartPay used by ZarinPal-Lab sample (VERIFIED) | `https://www.zarinpal.com/pg/StartPay/{authority}` | — |
| GraphQL (VERIFIED) | `https://next.zarinpal.com/api/v4/graphql/` | no sandbox documented (UNVERIFIED) |

Note: three production hosts (`payment.`, `api.`, `www.`) appear across official sources. The current official SDKs use `payment.zarinpal.com`; prefer it and make the host configurable.

Sandbox (SNIPPET of https://www.zarinpal.com/docs/paymentGateway/sandBox): "in the sandbox service you can enter any arbitrary UUID string for the merchant ID"; the sandbox page lets you "simulate a successful or failed transaction"; no real charges. Authority strings issued by the sandbox start with `S` (SNIPPET; consistent with the SDK regex `^[AS][0-9a-zA-Z]{35}$`, production authorities start with `A`). Sandbox limitations beyond this: UNVERIFIED.

## 4. Create payment (payment request)

- Method/URL (VERIFIED): `POST {base}/pg/v4/payment/request.json`
- Headers (VERIFIED from SDKs/sample): `Content-Type: application/json`, `Accept: application/json`; SDKs also send a `User-Agent`.
- Body (field names VERIFIED from `RequestRequest.php` / `Payments.ts` / `Request.php` sample; required/optional per SDK validation and docs SNIPPET):

| Field | Type | Required | Notes |
|---|---|---|---|
| `merchant_id` | string (UUID) | yes | |
| `amount` | integer | yes | Amount unit is selected by `currency`; default `IRR` (rial). Official docs SNIPPET: "amount ... in Rials, with a minimum of 10,000 Rials". PHP example comment: "Minimum amount 10000 IRR". (SDK client-side validators only enforce `>= 1000`.) |
| `currency` | string | no | `IRR` or `IRT` (VERIFIED enum in both SDK validators; PHP example: "Optional IRR Or IRT (default IRR)"). `IRT` = toman. |
| `callback_url` | string | yes | SDK validation: must start with `http://` or `https://`. Other rules (domain match etc.): UNVERIFIED. |
| `description` | string | yes | |
| `metadata` | object | no | PHP SDK and Lab sample send `metadata: { mobile, email, referrer_id?, card_pan? }`; docs SNIPPET: "metadata containing mobile, email, and order_id". Node SDK sends `mobile`/`email`/`cardPan`/`referrer_id` at top level instead — **which placement the server accepts for each key is UNVERIFIED; the `metadata` object form is used by the docs snippet and the Lab sample, so prefer it.** |
| `metadata.mobile` | string | no | SDK regex `^09[0-9]{9}$` |
| `metadata.email` | string | no | |
| `metadata.order_id` | string | no | From docs SNIPPET only |
| `metadata.card_pan` | string (16 digits) | no | Restrict payment to a card (docs page https://www.zarinpal.com/docs/paymentGateway/moreFeatures/card-pan exists; content SNIPPET only). PHP SDK may send an array? No — PHP sends a single string; Node accepts string or array. UNVERIFIED whether multiple PANs are accepted. |
| `referrer_id` | string | no | Sent inside `metadata` by PHP SDK, top-level by Node SDK and by docs SNIPPET example. |
| `wages` | array of `{ iban, amount, description }` | no | Revenue split; IBAN regex `^IR[0-9]{2}[0-9A-Z]{1,24}$` (PHP). Requires activation by ZarinPal (per legacy PDF; current constraints UNVERIFIED). |

- Success response (VERIFIED shape from `RequestResponse.php` and Lab sample): `{"data": {"code": 100, "message": "...", "authority": "A000...", "fee_type": "...", "fee": <int>}, "errors": []}`. The transaction identifier is **`data.authority`** (36 chars, `A` + 35 alphanumerics in production).
- Error response (VERIFIED shape from Lab sample / PHP SDK): `{"data": [], "errors": {"code": <negative int>, "message": "...", "validations": [...]}}`. Treat non-empty `errors` or empty `data` as failure.
- Redirect the customer to `GET {base}/pg/StartPay/{authority}` (VERIFIED).
- Fee pre-calculation (VERIFIED): `POST {base}/pg/v4/payment/feeCalculation.json` with `{merchant_id, amount, currency?}` → `data: {amount, fee, fee_type, suggested_amount, code, message}`.

## 5. Callback

- The customer returns to `callback_url` via **GET** with query parameters **`Authority`** and **`Status`** (VERIFIED: `Verification.php` sample reads `$_GET['Authority']`; PHP SDK `Verify.php` example reads `INPUT_GET` `Authority` and `Status`).
- `Status` is `OK` on success and `NOK` when the payment failed or the user cancelled (VERIFIED in PHP example: `if ($status === 'OK') ... else 'Transaction was cancelled or failed.'`; also in the legacy PDF).
- User cancellation therefore appears as `Status=NOK`. There is no distinct cancel code in the callback (UNVERIFIED whether verify returns a specific code for cancelled sessions; see -51 below).
- Whether ZarinPal can POST to the callback / can call it twice: UNVERIFIED. Implement idempotent handling keyed by `Authority`.

## 6. Verification

- Method/URL (VERIFIED): `POST {base}/pg/v4/payment/verify.json`
- Body (VERIFIED): `{"merchant_id": "...", "amount": <int>, "authority": "..."}`. `amount` must equal the original request amount (same unit/currency as requested; official docs SNIPPET and legacy PDF: mismatch → error).
- Success response (VERIFIED field names from `VerifyResponse.php`): `data: { code, message, authority, ref_id, card_pan, card_hash, fee_type, fee }`. `ref_id` is the bank reference to show the customer. `card_pan` is the masked PAN; `card_hash` a hash of the card.
- Codes (VERIFIED in official sources): `100` = verified successfully; `101` = already verified (docs SNIPPET: "On subsequent verifications of the same transaction, the code value will be 101"). Verify is therefore **idempotent** in effect: repeat calls return 101 rather than failing, but the second call should not be treated as a new success.
- Time limit for verification: UNVERIFIED for v4 (legacy PDF: customer has 15 minutes on the gateway page). Unverified paid sessions can be discovered via the unVerified endpoint (section 9).

## 7. Settlement / capture step

None. ZarinPal is a single-step gateway: verify is the capture. (VERIFIED by absence in all official SDK surfaces.)

## 8. Refund / reverse / cancel

Two distinct official mechanisms exist (VERIFIED in both SDKs):

1. **Reverse** (REST, uses `merchant_id`, no access token): `POST {base}/pg/v4/payment/reverse.json` with `{"merchant_id", "authority"}`. Response parsed as `data: {code, message, ...}`. Constraints (time window, whether only un-verified/verified sessions can be reversed): **UNVERIFIED**.
2. **Refund** (GraphQL, requires `access_token`): `POST https://next.zarinpal.com/api/v4/graphql/` with `Authorization: Bearer <access_token>` and body `{"query": ..., "variables": ...}`. Mutation used by the official Node SDK (VERIFIED, quoted):

```graphql
mutation AddRefund($session_id: ID!, $amount: BigInteger!, $description: String,
                   $method: InstantPayoutActionTypeEnum, $reason: RefundReasonEnum) {
  resource: AddRefund(session_id: $session_id, amount: $amount, description: $description,
                      method: $method, reason: $reason) {
    terminal_id, id, amount,
    timeline { refund_amount, refund_time, refund_status }
  }
}
```
   - `session_id`: the ZarinPal session (transaction) id — **not** the authority. PHP example uses `sessionId = '580868147'`. How to obtain it for a given authority: UNVERIFIED (likely via the `GetTransactions` GraphQL query, whose `id` field is returned; not confirmed).
   - `amount`: integer, "Amount in IRR" (PHP example comment).
   - `method`: `CARD` ("instant") or `PAYA` ("regular") (VERIFIED enum).
   - `reason`: `CUSTOMER_REQUEST`, `DUPLICATE_TRANSACTION`, `SUSPICIOUS_TRANSACTION`, `OTHER` (VERIFIED enum).
   - Other official GraphQL operations in the Node SDK: `GetRefund(id)`, `GetRefunds(terminal_id, limit, offset)`, `GetTransactions(terminal_id, filter, limit, offset)` with `filter` in `PAID | VERIFIED | TRASH | ACTIVE | REFUNDED` (VERIFIED). GraphQL errors arrive in a top-level `errors` array.
   - Partial refunds, fees on refunds, and limits: UNVERIFIED.

## 9. Inquiry / status endpoints

- **Inquiry** (VERIFIED): `POST {base}/pg/v4/payment/inquiry.json` with `{"merchant_id", "authority"}` → `data: {code, message, status, ...}`. Possible `status` values: UNVERIFIED (PHP SDK reads `status` as a string).
- **Unverified list** (VERIFIED): `POST {base}/pg/v4/payment/unVerified.json` with `{"merchant_id"}` → `data: {code, message, authorities: [{authority, amount, callback_url, referer, date}]}` (field names VERIFIED from `UnverifiedResponse.php`). Use it to recover paid-but-unverified sessions after a lost callback.

## 10. Error code table

The complete current table lives on the blocked page https://www.zarinpal.com/docs/paymentGateway/errorList; it could not be retrieved. Codes confirmed by official sources today:

| Code | Meaning | Evidence |
|---|---|---|
| 100 | Success (request created / payment verified) | VERIFIED (SDKs, Lab sample) |
| 101 | Payment already verified | VERIFIED (docs SNIPPET, PHP example) |
| -51 | "Session is not valid, session is not active paid try" (payment failed / not paid) | SNIPPET (search excerpt attributed to ZarinPal error list; treat as likely) |
| -9, -10, -11, -12, -15, -16, -17, -50, -52, -53, -54, -55 and others | Listed in the official error list page by number (page exists and covers request/verify errors) | **UNVERIFIED meanings** — not retrievable today. Do not hardcode texts; map unknown negative codes to a generic failure and log `errors.message`. |

Legacy (2014 SOAP) codes -1, -2, -3, -4, -11, -21, -22, -33, -34, -40, -41, -54 are documented in the official PDF but belong to the obsolete SOAP API and must not be assumed for v4. An official issue (ZarinPal-Lab/Documentation-PaymentGateway#1) notes the published table has been incomplete in the past.

## 11. Signature / HMAC / IP whitelist

None documented for REST v4 in any official source read (VERIFIED by absence in SDKs). Security relies on `merchant_id` + server-side verify with amount match. GraphQL uses the Bearer access token.

## 12. Known limitations and implementation notes

- Money: integers only; store the `currency` you send (`IRR`/`IRT`) and use the same `amount`/unit on verify.
- Always verify server-side even when `Status=OK`; never trust the callback alone.
- Treat code 101 as "already captured" — do not double-fulfil.
- Persist `authority` → order mapping before redirecting; handle lost callbacks with `unVerified.json`.
- Authority format: `^[AS][0-9a-zA-Z]{35}$` (VERIFIED SDK validator).
- `fee`/`fee_type` come back on request and verify responses; `feeCalculation.json` can quote fees up-front.
- Multiple production hostnames exist in official sources; keep the base URL configurable.
- Both official SDKs send a descriptive `User-Agent`; harmless to do the same.

## 13. Could NOT be verified from official sources (checklist)

- [ ] Full v4 error code table with meanings (page blocked).
- [ ] Exact `callback_url` rules (domain/https requirements) beyond "starts with http(s)://".
- [ ] Whether `mobile`/`email`/`order_id`/`referrer_id`/`card_pan` must be inside `metadata` or at top level (official sources disagree).
- [ ] Verification/expiry time limits for a paid but unverified session (v4).
- [ ] Constraints for `reverse.json` (time window, eligible states) and inquiry `status` enum values.
- [ ] Access-token issuance endpoint, lifetime, refresh flow, and whether a sandbox exists for GraphQL.
- [ ] How to obtain `session_id` for a verified authority (needed for `AddRefund`).
- [ ] Whether ZarinPal ever POSTs to the callback or retries it.
- [ ] Sandbox limitations beyond "any UUID merchant id" and `S`-prefixed authorities.
- [ ] Minimum amount (docs SNIPPET says 10,000 IRR; SDK validators say 1,000) — confirm against the live docs.
