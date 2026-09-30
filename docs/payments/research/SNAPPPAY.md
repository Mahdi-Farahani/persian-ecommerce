# SnappPay — Installment (BNPL) Gateway Integration Reference (research)

Research date: 2026-09-30.

**Headline finding: no official public SnappPay API documentation could be located or read.** Everything technical below that is not marked VERIFIED/SNIPPET is **UNVERIFIED** and must be confirmed against the documentation SnappPay hands to contracted merchants before implementation.

Evidence levels:
- **VERIFIED** — read directly from an official SnappPay-controlled source.
- **SNIPPET** — text of an official SnappPay page as returned in a search-engine excerpt; the page could not be opened.
- **UNVERIFIED** — only found in third-party code/blogs (which this research was instructed not to rely on) or not found at all.

## 1. Official documentation sources

| Source | URL | Reachable on 2026-09-30? |
|---|---|---|
| Corporate site | https://snapppay.ir/ | NO — blocked by the network egress policy (HTTP 403 on CONNECT) |
| Merchant acquisition page | https://snapppay.ir/merchant-aquisition/ | NO (indexed title only) |
| Merchant portal | https://portal.snapppay.ir/ | NO (blocked); described by search index as "Snapppay Merchants Portal for order management and reporting" |
| Merchant site (second) | https://merchant.snapppay.ir/ | NO (blocked) |
| Merchant academy (official education hub) | https://academy.snapppay.ir/ | NO (blocked); SNIPPETs only |
| Academy: "مسیر پذیرندگی اسنپ‌پی" (merchant onboarding path) | https://academy.snapppay.ir/2026/04/21/مسیر-پذیرندگی-در-اسنپپی/ | NO (SNIPPET) |
| Academy: installment-gateway activation plugin | https://academy.snapppay.ir/2026/03/03/افزونه-فعالسازی-درگاه-اقسطی-اسنپپ/ | NO (SNIPPET) |
| Academy: partner shop builders | https://academy.snapppay.ir/2026/06/13/shop-makers/ | NO (SNIPPET) |
| Hypothetical docs host | https://docs.snapppay.ir/ | Does not resolve (DNS `ENOTFOUND` from the fetch tool; not indexed by search engines). **No public developer-docs site exists under this name.** |
| Payment (customer-facing) host | https://payment.snapppay.ir/otp | NO (indexed title "اسنپ پی | پرداخت اقساطی") |
| Official GitHub org | https://github.com/snapppay | YES — organization exists (website `https://snapppay.ir`, bio "Developing and operating mission-critical fintech platforms at SnappPay") but has **0 public repositories**. |

What the official academy pages say (SNIPPET, paraphrased from search excerpts of academy.snapppay.ir):
- Stores built with "custom frameworks like Laravel, ASP.NET, Django, or manual coding" must integrate "through API"; "after contract approval, technical documentation and access information are provided to the developer".
- To formally announce go-live, the merchant must "create a test order with a minimum amount of 100,000 Tomans" and confirm the connection to the bank gateway.
- Ready-made plugins exist for shop builders; a PrestaShop plugin is mentioned; WooCommerce activation is covered by an academy article. No SnappPay plugin was found on wordpress.org.

Conclusion: SnappPay's API documentation is distributed privately to contracted merchants. It is not publicly published.

## 2. Authentication

- Model (UNVERIFIED — third-party packages only): OAuth2 bearer token obtained from a token endpoint with merchant `username`/`password` plus `client_id`/`client_secret` (HTTP Basic). Credential names as SnappPay calls them: UNVERIFIED.
- Token lifetime / refresh: UNVERIFIED.
- Nothing in an official source names any credential. Expect to receive: a client id, a client secret, a merchant username and password (UNVERIFIED).

## 3. Environments

- Production base URL: UNVERIFIED (not published by SnappPay).
- Sandbox/test base URL: UNVERIFIED. The academy SNIPPET implies a real "test order" on production with a minimum of 100,000 toman as part of launch acceptance; whether a separate sandbox exists is UNVERIFIED.
- Sandbox credentials: obtained through the merchant contract/portal (SNIPPET: "access information are provided to the developer" after contract approval).

## 4. Create payment

Endpoints named by the task brief and by third-party packages (UNVERIFIED path names, listed only so they can be checked against the private docs):

| Step | Path (UNVERIFIED) | Method (UNVERIFIED) |
|---|---|---|
| OAuth token | `api/online/v1/oauth/token` | POST |
| Eligibility check (amount) | `api/online/offer/v1/eligible` | GET |
| Payment token (create) | `api/online/payment/v1/token` | POST |
| Verify | `api/online/payment/v1/verify` | POST |
| Settle | `api/online/payment/v1/settle` | POST |
| Revert | `api/online/payment/v1/revert` | POST |
| Status / Update / Cancel | not even named in any reachable source | UNVERIFIED |

- Request body field names, types, required flags: UNVERIFIED.
- Amount unit: UNVERIFIED (the brief says IRR; the academy quotes merchant-facing amounts in toman; the API unit must be confirmed).
- Callback URL rules, description/mobile/email fields, cart/basket item structure, metadata: UNVERIFIED.
- Transaction identifier (`paymentToken` / `transactionId`): UNVERIFIED.
- Redirect URL pattern: UNVERIFIED (a hosted SnappPay page at `payment.snapppay.ir` exists per search index, but the URL contract is not documented publicly).

## 5. Callback

- Method, parameter names (`transactionId`, `paymentToken`, state), and cancel detection: UNVERIFIED.

## 6. Verification

- Endpoint, body, response fields, idempotency, and time limits: UNVERIFIED.

## 7. Settlement / capture

- A separate **settle** step after verify is consistently described for SnappPay (BNPL provider that funds the customer and settles to the merchant), but its contract (window, idempotency, partial settle) is UNVERIFIED.

## 8. Refund / reverse / cancel

- "Revert" is named as an operation (UNVERIFIED). Whether post-settlement refunds are supported via API, and any constraints: NOT DOCUMENTED in any reachable official source.

## 9. Inquiry / status endpoint

- NOT DOCUMENTED in any reachable official source (UNVERIFIED).

## 10. Error code table

- NOT DOCUMENTED in any reachable official source. No codes can be listed.

## 11. Signature / HMAC / IP whitelist

- UNVERIFIED. No official statement found.

## 12. Known limitations and implementation notes

- The only officially stated numeric constraint: go-live acceptance requires a test order of at least **100,000 toman** (SNIPPET, academy).
- SnappPay is an installment/credit provider, not a card acquirer: the customer must be an eligible Snapp user; an amount-eligibility check before showing the option at checkout is part of the intended flow (UNVERIFIED contract).
- Because the docs are private, the integration module must be built behind an adapter interface with every path, field and code configurable, and finalised only after the merchant contract delivers the technical document.
- Idempotency of verify/settle and duplicate callbacks: UNVERIFIED — design the adapter to be idempotent on the provider transaction id regardless.

## 13. Could NOT be verified from official sources (checklist)

- [ ] Any base URL (production or sandbox).
- [ ] Authentication credentials, token endpoint, grant type, token lifetime.
- [ ] All endpoint paths and HTTP methods.
- [ ] Request/response schemas for eligibility, token, verify, settle, revert, status, update, cancel.
- [ ] Amount unit (IRR vs toman) and minimum/maximum amounts.
- [ ] Callback method and parameter names; cancel signalling.
- [ ] Error codes.
- [ ] Signature/IP-whitelist requirements.
- [ ] Refund support after settlement.
- [ ] Whether a sandbox environment exists.

Action required: obtain the technical document and credentials from SnappPay via the merchant contract (portal.snapppay.ir) and re-run this reference against it.
