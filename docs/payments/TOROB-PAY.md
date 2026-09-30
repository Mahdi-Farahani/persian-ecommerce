# TorobPay (ترب‌پی) — adapter documentation

Adapter: `apps/api/src/payments/providers/torob-pay.provider.ts` (`TOROB_PAY_DEFINITION`, `TorobPayPaymentProvider`), built on `bnpl-token.provider.base.ts`.
Research notes with the evidence table: `docs/payments/research/TOROBPAY.md`.

> **Go-live requires confirming this adapter against the documentation delivered with the merchant contract** (or the source of the official "TorobPay for WooCommerce" plugin). No endpoint path was published anywhere, so **every path setting starts empty** and the adapter throws `MISCONFIGURED` naming the missing setting until it is filled. Field names are UNVERIFIED. Payment creation is blocked until «تأیید مطابقت با مستندات قرارداد» (`contractDocsConfirmed`) is `yes`.

## Official documentation source

| Source                                | URL                                                     | Status on review date                 |
| ------------------------------------- | ------------------------------------------------------- | ------------------------------------- |
| Corporate site                        | https://torobpay.com/                                   | Unreachable (HTTP 403)                |
| Merchant panel                        | https://panel.torobpay.com/                             | Unreachable                           |
| API host named by the official plugin | https://cpg.torobpay.com/                               | Unreachable (SNIPPET: "default host") |
| WooCommerce plugin listing            | https://wordpress.org/plugins/torobpay-for-woocommerce/ | Unreachable; search excerpts only     |
| Developer docs                        | none found                                              | —                                     |

`docsStatus` in the adapter definition: **UNVERIFIED**.

## Last documentation review date

2026-09-30

## Authentication

- Plugin listing (SNIPPET): the plugin authenticates the merchant against the TorobPay API and can "provision or refresh merchant credentials".
- Model implemented (UNVERIFIED, third-party summaries): OAuth2 password grant where **`merchantId` / `merchantKey` act as client id / client secret** (HTTP Basic on the token call) and `username` / `password` are the grant credentials. The bearer token is memoized per instance (`expires_in` minus 30 s), refreshed once and retried once on HTTP 401; 401/403 (or 400 `invalid_grant`/`invalid_client`) on the token call → `INVALID_CREDENTIALS`.

## Endpoints

All paths are admin settings with **empty defaults**; each may be a relative path or an absolute URL.

| Operation       | Method      | Setting            | Evidence                                                            |
| --------------- | ----------- | ------------------ | ------------------------------------------------------------------- |
| Token           | POST (form) | `tokenPath`        | UNVERIFIED                                                          |
| Create payment  | POST (JSON) | `paymentTokenPath` | plugin confirms "create/update payments" (SNIPPET); path UNVERIFIED |
| Verify          | POST (JSON) | `verifyPath`       | UNVERIFIED                                                          |
| Settle          | POST (JSON) | `settlePath`       | UNVERIFIED (third-party only)                                       |
| Revert / refund | POST (JSON) | `revertPath`       | plugin "supports refunds" (SNIPPET); path UNVERIFIED                |
| Status          | POST (JSON) | `statusPath`       | plugin "check[s] payment status" (SNIPPET); path UNVERIFIED         |

## Sandbox

- `supportsSandbox: false`; no sandbox host is mentioned anywhere. `sandboxBaseUrl` defaults to empty and may be filled if TorobPay supplies one (SANDBOX still needs `supportsSandbox` flipped in code once confirmed).

## Production

- `productionBaseUrl` defaults to `https://cpg.torobpay.com` (SNIPPET-confirmed host; path prefix UNVERIFIED).
- Enabling in production requires the explicit production confirmation plus `contractDocsConfirmed = yes` and all path settings.

## Create payment

`createPayment` → `POST {base}/{paymentTokenPath}` with bearer token. Body (UNVERIFIED — the plugin listing only says order ids, amounts, currency, line items, discounts and customer contact fields are sent):

| Field           | Value                                          |
| --------------- | ---------------------------------------------- |
| `amount`        | integer in `amountUnit` (IRR default, IRT ÷10) |
| `currency`      | `IRR` or `IRT` (the configured unit)           |
| `mobile`        | customer mobile when known                     |
| `returnURL`     | our callback URL                               |
| `transactionId` | our payment attempt id (`paymentId`)           |
| `orderId`       | order number                                   |
| `items`         | `[{ name, count, amount }]`                    |

Expected envelope (UNVERIFIED): `{ successful: true, response: { paymentToken, paymentPageUrl } }` (aliases `token`, `paymentUrl`, `redirectUrl` accepted). `paymentToken` becomes the authority; the customer is redirected (GET) to `paymentPageUrl`. `{ successful: false, errorData: { errorCode, message } }` → `PROVIDER_REJECTED`.

## Callback

- Method and parameters UNVERIFIED. POST body is merged over GET query; `paymentToken`/`token` → `authority`, `transactionId` → `reference`, `state`/`status`/`result` → outcome (OK / FAILED / CANCELLED / UNKNOWN word tables in `bnpl-token.provider.base.ts`), `amount` → IRR when present.
- `parseCallback` never throws.

## Verification

`POST {base}/{verifyPath}` with `{ paymentToken }` (UNVERIFIED). Mapping identical to SnappPay: `successful: true` → `PAID` (`providerTransactionId = transactionId ?? paymentToken`, `amount` in IRR when echoed, `cardPanMask: null`, `alreadyVerified` only when a status word says so); `successful: false` or a failure status word → `FAILED`; 5xx → `PROVIDER_UNAVAILABLE`; credential/transport problems throw.

## Settlement

`settlePayment` → `POST {base}/{settlePath}` with `{ paymentToken }` (UNVERIFIED; described by third-party summaries only). Called automatically after a successful verify; failures are logged for reconciliation. Capability declared: `settle`.

## Refund/reverse

`refundPayment` → `POST {base}/{revertPath}` with `{ paymentToken, amount, description }` (UNVERIFIED). The official plugin confirms refunds exist; partial refunds and time limits are UNVERIFIED. Capability declared: `refund`.

## Error codes

NOT AVAILABLE. `errorData.errorCode`/`message` are surfaced verbatim; nothing is hard-coded.

## Required credentials

All secret, all required; names are those reported by research and must be matched to what the TorobPay merchant panel issues.

| Key           | Label                        | Use                                       |
| ------------- | ---------------------------- | ----------------------------------------- |
| `merchantId`  | شناسهٔ پذیرنده (Merchant ID) | OAuth client id (HTTP Basic user)         |
| `merchantKey` | کلید پذیرنده (Merchant Key)  | OAuth client secret (HTTP Basic password) |
| `username`    | نام کاربری پذیرنده           | password-grant username                   |
| `password`    | رمز عبور پذیرنده             | password-grant password                   |

## Environment variables

Bootstrap only; prefix `TOROB_PAY`.

```text
TOROB_PAY_ENABLED=true|false
TOROB_PAY_ENVIRONMENT=PRODUCTION
TOROB_PAY_DEFAULT=true|false
TOROB_PAY_MERCHANT_ID=
TOROB_PAY_MERCHANT_KEY=
TOROB_PAY_USERNAME=
TOROB_PAY_PASSWORD=
TOROB_PAY_CONTRACT_DOCS_CONFIRMED=no|yes
TOROB_PAY_AMOUNT_UNIT=IRR|IRT
TOROB_PAY_PRODUCTION_BASE_URL=https://cpg.torobpay.com
TOROB_PAY_SANDBOX_BASE_URL=
TOROB_PAY_TOKEN_PATH=            # required; not published
TOROB_PAY_PAYMENT_TOKEN_PATH=    # required; not published
TOROB_PAY_VERIFY_PATH=           # required; not published
TOROB_PAY_SETTLE_PATH=           # required; not published
TOROB_PAY_REVERT_PATH=           # required for refunds
TOROB_PAY_STATUS_PATH=           # required for inquiry
```

## Admin configuration

Admin → تنظیمات → درگاه‌های پرداخت → ترب‌پی:

1. Enter the four credentials from the merchant panel.
2. Confirm «آدرس پایهٔ عملیاتی» (`https://cpg.torobpay.com` by default).
3. Fill every path setting from the contract documentation / plugin source (they are empty on purpose).
4. Choose «واحد مبلغ ارسالی».
5. Run «آزمون اتصال» (token exchange only; warns while contract docs are unconfirmed).
6. Set «تأیید مطابقت با مستندات قرارداد» to «بله».
7. Enable (production confirmation required).

## Known limitations

- Nothing about the API contract is public; the adapter is a configurable skeleton until documentation arrives.
- Inquiry maps status words (`PAID`/`VERIFIED`/`SETTLED` → PAID; `FAILED`/`CANCELLED`/`EXPIRED`/`REVERTED` → FAILED; `PENDING`/`CREATED`/`IN_PROGRESS`/`INITIATED` → PENDING; else UNKNOWN) that are UNVERIFIED.
- Installment widgets, QR in-store payments and discount widgets offered by the plugin are out of scope.
- Duplicate verification is surfaced as `FAILED` unless a status word marks it as already verified.
- No sandbox.

## Implementation notes

- Shares `BnplTokenProviderBase` with SnappPay; only the definition, the credential-to-grant mapping, the create body and `inquirePayment` are TorobPay-specific.
- Provider payloads are parsed from a redacted copy so `raw` and messages never contain credentials or tokens (`merchantKey`, `password`, `access_token`, … keys are stripped; strings containing a credential value are replaced).
- Amount conversion via `toProviderAmount`/`fromProviderAmount`.

## Verification checklist

Copied from research §13; status vocabulary: IMPLEMENTED / NOT SUPPORTED BY PROVIDER / NOT AVAILABLE IN SANDBOX / REQUIRES PRODUCTION CREDENTIALS / UNVERIFIED.

- [ ] Any endpoint path or HTTP method. — Status: UNVERIFIED (paths must be entered; configurable IMPLEMENTED)
- [ ] Credential names, token endpoint, grant type, token lifetime. — Status: UNVERIFIED (password grant + bearer IMPLEMENTED)
- [ ] Sandbox existence and base URL. — Status: UNVERIFIED (`supportsSandbox: false`)
- [ ] Request/response schemas for create, verify, settle, refund, cancel, status. — Status: UNVERIFIED (create/verify/settle/revert/status IMPLEMENTED with assumed schema; cancel not implemented)
- [ ] Amount unit and limits. — Status: UNVERIFIED (unit configurable)
- [ ] Callback method, parameters, cancel signalling. — Status: UNVERIFIED (tolerant GET/POST parsing IMPLEMENTED)
- [ ] Error codes. — Status: UNVERIFIED
- [ ] Signature / IP whitelist requirements. — Status: UNVERIFIED
- [ ] Whether the WordPress.org plugin is published by TorobPay itself (author not retrievable). — Status: UNVERIFIED
- [ ] Whether `pay.torob.com` exists. — Status: UNVERIFIED (not used by the adapter)

Go-live rule: none of the boxes above may remain unchecked for an enabled production gateway; confirm each item against the contract-supplied documentation, fill the paths, then set `contractDocsConfirmed = yes`.
