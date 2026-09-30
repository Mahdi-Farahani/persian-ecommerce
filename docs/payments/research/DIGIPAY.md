# DigiPay (دیجی‌پی, by Digikala) — UPG Integration Reference (research)

Research date: 2026-09-30.

Evidence levels:
- **VERIFIED** — read directly from an official DigiPay-controlled source.
- **SNIPPET** — text of the official documentation page as returned in a search-engine excerpt; the page itself could not be opened.
- **UNVERIFIED** — appears only in third-party SDKs/packages (excluded as sources by this research) or not found at all.

## 1. Official documentation sources

| Source | URL | Reachable on 2026-09-30? |
|---|---|---|
| **Official merchant-platform docs ("مستندات پلتفرم پذیرندگان دیجی‌پی", UPG)** | https://www.mydigipay.com/developers/docs/upg/ | NO — `www.mydigipay.com` is blocked by the network egress policy (HTTP 403 on CONNECT). Page existence, title and several sentences are confirmed by search-engine excerpts (SNIPPET). |
| Alternate docs host named in the brief | https://docs.mydigipay.com/ | NO — blocked (403). Not found in any search index; may not exist. |
| Corporate site / IPG product page | https://www.mydigipay.com/ , https://www.mydigipay.com/ipg/ , https://www.mydigipay.com/pdy/ | NO (blocked; titles indexed) |
| Business portal | https://business.mydigipay.com/ | NO (blocked) |
| Production API host | https://api.mydigipay.com/ | NO (blocked) |
| Sandbox (UAT) API host | https://uat.mydigipay.info/ | NO (blocked) |
| GitHub account `mydigipay` | https://github.com/mydigipay | YES — exists but has **no public repositories**, no website link, no verification badge. Cannot be confirmed as official. |
| WordPress.org profile `digipay` | https://profiles.wordpress.org/digipay/ | NO (blocked). Search index: joined Oct 2020 as a plugin developer; commits in Dec 2022 mention "payment expiry configuration and installment payment processing". The UPG docs page (SNIPPET) links to a WordPress plugin download. Plugin slug/source not retrievable. |

## 2. Authentication

What the official page states (SNIPPET of https://www.mydigipay.com/developers/docs/upg/):
- Calls are made with an OAuth token; "if the token is expired or invalid, the HTTP response code of the web-service call with that token will be **401**".

Named in the brief and in third-party SDKs (UNVERIFIED wording): token endpoint `POST /digipay/api/oauth/token` with `grant_type=password`, merchant `username`/`password`, and HTTP Basic `client_id:client_secret`. Third-party summaries describe the credentials as a merchant username/password (OAuth password grant) plus client id/secret. **Exact credential names as DigiPay calls them, token lifetime, and refresh flow: UNVERIFIED.**

Headers seen in the official docs excerpt (SNIPPET): `Agent: WEB` and `Digipay-Version: 2022-02-02`. Whether both are mandatory on every call, and the allowed values of `Agent` (e.g. `WEB`, `ANDROID`, `IOS`): UNVERIFIED.

## 3. Environments

| | URL | Evidence |
|---|---|---|
| Production base | `https://api.mydigipay.com/digipay/api` | Consistently reported in search excerpts (third-party SDK READMEs and summaries). Host `api.mydigipay.com` is a real DigiPay host (blocked, so it exists on the policy list). **Path prefix UNVERIFIED against the official page.** |
| Sandbox / UAT base | `https://uat.mydigipay.info/digipay/api` | Same evidence level as above — UNVERIFIED against the official page. |

How to obtain sandbox credentials and sandbox limitations: UNVERIFIED (not in any reachable official text).

## 4. Create payment (ticket)

Official statements (SNIPPET of the UPG docs page):
- "The purchase ticket-creation service is called; its inputs include the amount, the mobile number, the return address, etc. In the response a **`payUrl`** is returned, which directs the user to the page to continue the payment process and complete the purchase."
- UPG is described as a collection of DigiPay payment tools (wallet, credit/BNPL, card gateway) selected per business need; the product is chosen with a ticket **`type`** passed as a query parameter.

Names consistently reported (UNVERIFIED against the official page; from the brief and third-party summaries of the docs):

| Item | Value (UNVERIFIED unless noted) |
|---|---|
| Endpoint | `POST {base}/tickets/business?type={type}` |
| Headers | `Authorization: Bearer <token>`, `Content-Type: application/json`, `Agent: WEB`, `Digipay-Version: 2022-02-02` (last two SNIPPET) |
| Body fields | `amount` (integer), `cellNumber` (customer mobile), `providerId` (merchant's unique order id — SNIPPET confirms `providerId` is "the unique ID registered from your side for the purchase"), `redirectUrl` / `callbackUrl` (return address; SNIPPET says results are POSTed to the merchant's "RedirectURL"), `basketDetailsData` (basket for credit products), `callbackUrl`, `preferredGateway`? |
| Amount unit | IRR (rial) per the brief; UNVERIFIED in official text |
| `type` values | UNVERIFIED (numeric ticket types select wallet / IPG / credit; e.g. `0`, `11` seen in third-party code — do not rely on them) |
| Response | `payUrl` (SNIPPET-confirmed) plus a ticket identifier (`ticket`?) — UNVERIFIED |
| Redirect | Send the customer to the returned `payUrl` (SNIPPET) |

## 5. Callback

Official statements (SNIPPET):
- "Payment results are sent via a **POST** request to the **RedirectURL** of the merchant when a user enters payment gateways (credit purchases or IPG)."
- "Before starting the payment verification process, the **`amount`** (purchase amount) and **`providerId`** values sent in the payment result should be carefully verified and matched with the transaction information registered in your system."

Parameter names in that POST (UNVERIFIED): `trackingCode`, `providerId`, `amount`, `type`, `result`/`status`. Third-party summaries say the tracking code is carried as a callback field keyed **`trackingCode`**. How user cancellation is signalled: UNVERIFIED.

## 6. Verification

- Endpoint (UNVERIFIED): `POST {base}/purchases/verify/{trackingCode}?type={type}` with the same auth headers and an empty body.
- Response fields (UNVERIFIED): `result: { status, message, title, level }`, `trackingCode`, `amount`, `providerId`, `paymentGateway`, `rrn`, `paymentResult`, etc.
- Idempotency and time limits: UNVERIFIED. The official page (SNIPPET) mentions a **25-minute** window in the context of reversing a purchase after confirmation (see section 8).

## 7. Settlement / confirm ("deliver")

- For BNPL/credit products, third-party summaries of the docs say the merchant must send a **delivery confirmation** once goods are shipped ("deliver"). Endpoint path and body: UNVERIFIED.

## 8. Refund / reverse / cancel

Official statement (SNIPPET): there is a step "for when the purchase has been confirmed by you and, within **less than 25 minutes**, you intend to perform a refund and cancel the purchase." This confirms a short-window reversal exists after confirmation.

Refund API named in the brief (UNVERIFIED): `/refunds/config` (retrieve refund configuration), refund request, and refund inquiry endpoints exist in third-party SDKs. Exact paths, bodies and constraints: UNVERIFIED.

## 9. Inquiry / status endpoint

- NOT DOCUMENTED in any reachable official text. UNVERIFIED.

## 10. Error code table

- Only official fact: expired/invalid token → HTTP **401** (SNIPPET).
- Business `result.status` codes and their meanings: UNVERIFIED / NOT retrievable. Do not hardcode.

## 11. Signature / HMAC / IP whitelist

- No official statement found. UNVERIFIED.

## 12. Known limitations and implementation notes

- Callback is a **POST** to the merchant's redirect URL (SNIPPET): the callback route must accept POST (and probably also GET), must be CSRF-exempt, and must re-validate `amount` and `providerId` against the stored order before calling verify (official instruction).
- Use `providerId` = your internal unique order/payment id; DigiPay echoes it back.
- Post-confirmation reversal window of 25 minutes (SNIPPET) — refunds after that likely go through a different refund flow (UNVERIFIED).
- The `type` query parameter is required on every call and selects the product; keep it configurable per payment method (wallet / IPG / credit).
- Always send `Agent` and `Digipay-Version` headers; treat 401 as "refresh token and retry once".

## 13. Could NOT be verified from official sources (checklist)

- [ ] Exact base URL path prefix (`/digipay/api`) for production and UAT.
- [ ] OAuth token endpoint path, grant type, credential field names, token lifetime.
- [ ] Ticket creation body schema (`cellNumber`, `providerId`, `redirectUrl`, `basketDetailsData`, …) and the list of `type` values.
- [ ] Callback POST parameter names and cancel/failure signalling.
- [ ] Verify endpoint path, response schema, idempotency, time limit.
- [ ] Deliver/confirm endpoint for credit purchases.
- [ ] Refund endpoints (`/refunds/config`, refund request, refund inquiry) and constraints beyond the 25-minute reversal note.
- [ ] Inquiry/status endpoint.
- [ ] Error code table.
- [ ] Sandbox credential provisioning and limitations.
- [ ] Whether `github.com/mydigipay` and `profiles.wordpress.org/digipay` are official.

Action required: open https://www.mydigipay.com/developers/docs/upg/ from an unrestricted network (or obtain the PDF/plugin from DigiPay's business portal) and fill the UNVERIFIED items.
