# DigiPay (دیجی‌پی) — adapter documentation

Adapter: `apps/api/src/payments/providers/digipay.provider.ts` (`DIGIPAY_DEFINITION`, `DigiPayPaymentProvider`).
Research notes with the evidence table: `docs/payments/research/DIGIPAY.md`.

> **Go-live requires confirming this adapter against the documentation delivered with the merchant contract.** The official docs page was unreachable during research; only a handful of facts are confirmed from search-engine excerpts (SNIPPET). Everything marked UNVERIFIED is an assumption that operators must check and, where needed, correct from the admin panel. Payment creation is blocked until the admin setting «تأیید مطابقت با مستندات قرارداد» (`contractDocsConfirmed`) is set to `yes`.

## Official documentation source

| Source                       | URL                                            | Status on review date                                          |
| ---------------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| Merchant platform docs (UPG) | https://www.mydigipay.com/developers/docs/upg/ | Unreachable (HTTP 403 through the egress proxy); excerpts only |
| Business portal              | https://business.mydigipay.com/                | Unreachable                                                    |
| Production API host          | https://api.mydigipay.com/                     | Unreachable (host exists)                                      |
| Sandbox (UAT) host           | https://uat.mydigipay.info/                    | Unreachable (host exists)                                      |

`docsStatus` in the adapter definition: **PARTIAL**.

## Last documentation review date

2026-09-30

## Authentication

- Model: OAuth2 bearer token (SNIPPET-confirmed: an expired/invalid token yields HTTP **401**).
- Token exchange implemented as the OAuth2 password grant: `POST {base}/{tokenPath}` with form body `grant_type=password&username=…&password=…` and `Authorization: Basic base64(clientId:clientSecret)`. **UNVERIFIED** — the grant type and credential names come from third-party summaries.
- Every call carries `Agent: WEB` and `Digipay-Version: 2022-02-02` (SNIPPET-confirmed header names/values; whether both are mandatory on every call is UNVERIFIED). The adapter sends them on the token call and on every business call.
- Token handling: memoized per adapter instance (an instance lives for one operation) honouring `expires_in` with a 30-second margin. HTTP 401 on a business call → the token is refreshed once and the call retried once; a second 401 → `INVALID_CREDENTIALS`. HTTP 401/403 on the token call, or 400 with `invalid_grant`/`invalid_client`/`unauthorized_client`, → `INVALID_CREDENTIALS`.

## Endpoints

All paths are admin settings and default to the values below; a path may also be an absolute URL.

| Operation                 | Method                 | Default path (setting)                                                | Evidence                                                |
| ------------------------- | ---------------------- | --------------------------------------------------------------------- | ------------------------------------------------------- |
| Token                     | POST (form)            | `oauth/token` (`tokenPath`)                                           | UNVERIFIED                                              |
| Create ticket             | POST (JSON)            | `tickets/business` (`ticketPath`), query `type={ticketType}` when set | UNVERIFIED (query `type` selects the product — SNIPPET) |
| Verify                    | POST (empty JSON body) | `purchases/verify/{trackingCode}` (`verifyPath`), query `type`        | UNVERIFIED                                              |
| Refund / reverse          | POST (JSON)            | `refunds` (`refundPath`), query `type`                                | UNVERIFIED                                              |
| Deliver (credit products) | —                      | not implemented                                                       | UNVERIFIED path/body                                    |
| Inquiry / status          | —                      | not implemented                                                       | not documented                                          |

## Sandbox

- `supportsSandbox: true`.
- Default base URL `https://uat.mydigipay.info/digipay/api` (`sandboxBaseUrl`) — host confirmed to exist, path prefix UNVERIFIED.
- Sandbox credential provisioning and limitations: UNVERIFIED (NOT AVAILABLE IN SANDBOX could not be determined).

## Production

- Default base URL `https://api.mydigipay.com/digipay/api` (`productionBaseUrl`) — host confirmed to exist, path prefix UNVERIFIED.
- Enabling the provider in production requires the admin's explicit production confirmation (registry rule) and `contractDocsConfirmed = yes`.

## Create payment

`createPayment` → `POST {base}/tickets/business[?type=…]` with bearer token and the two DigiPay headers. Body (UNVERIFIED names unless noted):

| Field                        | Value                                                   | Evidence                                                                               |
| ---------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `amount`                     | integer in `amountUnit` (IRR default; IRT converts ÷10) | unit UNVERIFIED                                                                        |
| `cellNumber`                 | customer mobile when known                              | UNVERIFIED                                                                             |
| `providerId`                 | our payment attempt id (`paymentId`)                    | SNIPPET: "the unique ID registered from your side for the purchase"                    |
| `redirectUrl`, `callbackUrl` | our callback URL (both names sent)                      | SNIPPET: results are POSTed to the merchant "RedirectURL"; exact field name UNVERIFIED |
| `description`                | order description                                       | UNVERIFIED                                                                             |

Response: `payUrl` (SNIPPET-confirmed) is the redirect target (GET). The stored authority is `trackingCode` or `ticket` from the response when present, otherwise our `providerId` (which DigiPay echoes back). `basketDetailsData` for credit products is not sent (structure UNVERIFIED).

## Callback

- DigiPay sends the result as an HTTP **POST** to the redirect URL (SNIPPET); the adapter accepts GET as well and merges the POST body over the query string.
- Fields read: `trackingCode` → `providerTransactionId`; `providerId` → `reference`; `amount` → `ParsedCallback.amount` converted to IRR; `result`/`status`/`paymentResult` → outcome (UNVERIFIED names; success words `SUCCESS`/`OK`/`PAID`/`0`, failure words `FAILED`/`FAIL`/`NOK`/`ERROR`, cancel words `CANCEL`/`CANCELED`/`CANCELLED`, otherwise `UNKNOWN`).
- `authority` is always `null` in the parsed callback because the create response may not have contained the tracking code; the payment is located by the `paymentId` query hint or by `providerId`. `PaymentsService` re-checks the echoed `amount` against the stored attempt before verification, as the official docs instruct (SNIPPET).
- `parseCallback` never throws.

## Verification

`POST {base}/purchases/verify/{trackingCode}[?type=…]` with an empty JSON body (UNVERIFIED). The tracking code is taken from the callback, falling back to the stored authority.

Result mapping:

- HTTP 2xx and `result.status` absent or `0` → `PAID` with `providerTransactionId = trackingCode`, `amount` converted to IRR when echoed, `cardPanMask: null`, `alreadyVerified: false` (DigiPay's duplicate signal is UNVERIFIED; a decline on re-verify is returned as `FAILED`).
- Echoed `providerId` different from our payment id → `FAILED` with code `TRANSACTION_MISMATCH`.
- Any other 2xx/4xx → `FAILED` with `result.status` / `result.message`.
- HTTP 5xx → `PaymentProviderError(PROVIDER_UNAVAILABLE, retryable)`; credential/transport problems throw.

## Settlement

Status: **NOT IMPLEMENTED / UNVERIFIED.** Third-party summaries mention a delivery confirmation ("deliver") for credit purchases; no path or body could be confirmed, so no `settle` capability is declared (declaring it would make the platform call it after every verify). Add it once the contract documentation defines it.

## Refund/reverse

- SNIPPET-confirmed fact: a confirmed purchase can be reversed within **25 minutes** (`DIGIPAY_REVERSAL_WINDOW_MINUTES`).
- `refundPayment` → `POST {base}/refunds[?type=…]` with `{ trackingCode, providerId, amount, description }` (UNVERIFIED path and fields). A provider decline is returned as `succeeded: false` with the reported code and a message noting the 25-minute window. Refunds outside the window must be handled in DigiPay's business panel until the refund API is confirmed.
- Capability declared: `refund`.

## Error codes

- Only official fact: expired/invalid token → HTTP 401.
- Business codes (`result.status`) and meanings: NOT AVAILABLE. The adapter treats `0`/absent as success and reports any other value verbatim as `errorCode` with the provider message; nothing is hard-coded.

## Required credentials

All secret, all required. Names follow third-party reports and must be matched to what DigiPay issues.

| Key            | Label                      | Use                                   |
| -------------- | -------------------------- | ------------------------------------- |
| `clientId`     | شناسهٔ کلاینت (Client ID)  | HTTP Basic user on the token call     |
| `clientSecret` | رمز کلاینت (Client Secret) | HTTP Basic password on the token call |
| `username`     | نام کاربری پذیرنده         | password-grant username               |
| `password`     | رمز عبور پذیرنده           | password-grant password               |

## Environment variables

Bootstrap only (seed the row on first boot; admin edits win afterwards). Prefix `DIGIPAY`.

```text
DIGIPAY_ENABLED=true|false
DIGIPAY_ENVIRONMENT=SANDBOX|PRODUCTION
DIGIPAY_DEFAULT=true|false
DIGIPAY_CLIENT_ID=
DIGIPAY_CLIENT_SECRET=
DIGIPAY_USERNAME=
DIGIPAY_PASSWORD=
DIGIPAY_CONTRACT_DOCS_CONFIRMED=no|yes
DIGIPAY_AMOUNT_UNIT=IRR|IRT
DIGIPAY_PRODUCTION_BASE_URL=https://api.mydigipay.com/digipay/api
DIGIPAY_SANDBOX_BASE_URL=https://uat.mydigipay.info/digipay/api
DIGIPAY_TOKEN_PATH=oauth/token
DIGIPAY_TICKET_PATH=tickets/business
DIGIPAY_TICKET_TYPE=
DIGIPAY_VERIFY_PATH=purchases/verify/{trackingCode}
DIGIPAY_REFUND_PATH=refunds
```

## Admin configuration

Admin → تنظیمات → درگاه‌های پرداخت → دیجی‌پی:

1. Enter the four credentials.
2. Choose the environment (sandbox is supported).
3. Check the base URLs and the paths against the contract documentation; set «نوع تیکت (پارامتر type)» to the product code DigiPay assigned (wallet / IPG / credit). When it is empty no `type` query is sent.
4. Choose «واحد مبلغ ارسالی» (IRR default).
5. Run «آزمون اتصال»: it performs only the token exchange. While the contract docs are unconfirmed the message says so explicitly.
6. Set «تأیید مطابقت با مستندات قرارداد» to «بله» — only then can payments be created.
7. Enable the gateway (production requires the explicit confirmation dialog).

## Known limitations

- Deliver/settle for credit purchases: not implemented.
- Inquiry/status: not implemented (no endpoint documented); reconciliation relies on verify.
- `basketDetailsData` is not sent; credit products may require it.
- Duplicate verification is reported as `FAILED` with the provider's message rather than `alreadyVerified: true`.
- User cancellation detection depends on UNVERIFIED status words; unrecognized callbacks are `UNKNOWN` and decided by verify.
- Sandbox provisioning and limits unknown.

## Implementation notes

- The tracking code arrives in the callback, not necessarily at create time; therefore `parseCallback.authority` is `null` and the code is carried in `providerTransactionId`, which verify prefers over the stored authority.
- All provider payloads are parsed from a redacted copy (`redactSensitive`): keys such as `access_token`, `password`, `client_secret`, `authorization` are removed and any string containing a credential value is replaced, so `raw` payloads and error messages never contain secrets.
- Amount conversion uses `toProviderAmount`/`fromProviderAmount`; IRT requires rial amounts that are multiples of 10.
- `testConnection` is allowed even when the contract gate is closed.

## Verification checklist

Copied from research §13; status vocabulary: IMPLEMENTED / NOT SUPPORTED BY PROVIDER / NOT AVAILABLE IN SANDBOX / REQUIRES PRODUCTION CREDENTIALS / UNVERIFIED.

- [ ] Exact base URL path prefix (`/digipay/api`) for production and UAT. — Status: UNVERIFIED (configurable default IMPLEMENTED)
- [ ] OAuth token endpoint path, grant type, credential field names, token lifetime. — Status: UNVERIFIED (password grant IMPLEMENTED; path configurable)
- [ ] Ticket creation body schema (`cellNumber`, `providerId`, `redirectUrl`, `basketDetailsData`, …) and the list of `type` values. — Status: UNVERIFIED (`providerId`/`payUrl` SNIPPET; `basketDetailsData` not sent)
- [ ] Callback POST parameter names and cancel/failure signalling. — Status: UNVERIFIED (POST with `amount`/`providerId` SNIPPET; parsing IMPLEMENTED tolerant of GET/POST)
- [ ] Verify endpoint path, response schema, idempotency, time limit. — Status: UNVERIFIED (configurable path IMPLEMENTED)
- [ ] Deliver/confirm endpoint for credit purchases. — Status: UNVERIFIED (not implemented)
- [ ] Refund endpoints (`/refunds/config`, refund request, refund inquiry) and constraints beyond the 25-minute reversal note. — Status: UNVERIFIED (25-minute window documented; configurable refund path IMPLEMENTED)
- [ ] Inquiry/status endpoint. — Status: UNVERIFIED (not implemented)
- [ ] Error code table. — Status: UNVERIFIED (401 on expired token honoured)
- [ ] Sandbox credential provisioning and limitations. — Status: REQUIRES PRODUCTION CREDENTIALS / UNVERIFIED
- [ ] Whether `github.com/mydigipay` and `profiles.wordpress.org/digipay` are official. — Status: UNVERIFIED

Go-live rule: none of the boxes above may remain unchecked for an enabled production gateway; confirm each item against the contract-supplied documentation, correct the settings, then set `contractDocsConfirmed = yes`.
