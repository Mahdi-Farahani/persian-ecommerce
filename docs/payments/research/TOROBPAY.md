# TorobPay (ترب‌پی) — Installment (BNPL) Gateway Integration Reference (research)

Research date: 2026-09-30.

**Headline finding: no public TorobPay API documentation site was found, and every TorobPay host is blocked from this environment.** The only official artefact discoverable is the WordPress.org plugin "TorobPay for WooCommerce", whose page could not be opened; only its search-indexed description was readable.

Evidence levels:
- **VERIFIED** — read directly from an official TorobPay-controlled source.
- **SNIPPET** — text of an official page/plugin listing as returned in a search-engine excerpt.
- **UNVERIFIED** — from third-party packages only, or not found.

## 1. Official documentation sources

| Source | URL | Reachable on 2026-09-30? |
|---|---|---|
| Corporate site | https://torobpay.com/ | NO — blocked by the network egress policy (HTTP 403 on CONNECT). Indexed pages are consumer-facing ("خرید قسطی با ترب‌پی"). |
| Merchant panel | https://panel.torobpay.com/ (indexed: `/s/merchant-info`) | NO (blocked) |
| API host used by the official plugin | https://cpg.torobpay.com/ | NO (blocked). Named as "default host" in the plugin description (SNIPPET). |
| Alternate host named in the brief | https://pay.torob.com/ | Not found in any search index; UNVERIFIED that it exists. |
| Hypothetical docs hosts | https://docs.torobpay.com/ , https://developer(s).torobpay.com/ | Blocked / not indexed; **no evidence a public docs site exists**. |
| Official WooCommerce plugin listing | https://wordpress.org/plugins/torobpay-for-woocommerce/ | NO — `wordpress.org`, `plugins.svn.wordpress.org`, `plugins.trac.wordpress.org`, `downloads.wordpress.org`, `api.wordpress.org` are all blocked. SNIPPETs only. Plugin author identity could not be confirmed as TorobPay itself. |
| Translation request for the plugin | https://make.wordpress.org/polyglots/2026/08/24/pte-request-for-torobpay-for-woocommerce/ | NO (blocked; title only) |
| Torob (parent) GitHub org | https://github.com/torob | YES — org of Torob price-comparison service (website torob.ir); **contains no TorobPay/payment repositories**. |
| GitHub search `torobpay` | — | Only third-party/community repos (e.g. Laravel helpers, a Bagisto integration); none official. |

## 2. Authentication

From the official plugin listing (SNIPPET): the plugin "communicates with TorobPay APIs (default host: **cpg.torobpay.com**) to authenticate the merchant, create/update payments, check payment status, sync order details, and provision or refresh merchant credentials"; merchants "enter your merchant credentials (or use the in-plugin credential fetch if available for your account)". Data sent may include "merchant API credentials/tokens".

Credential names reported by third-party summaries (UNVERIFIED): merchant `username`/`password` (OAuth password grant) and `MerchantID`/`MerchantKey` acting as OAuth client id/secret; the API is "an OAuth-protected REST service" issuing a bearer token. Token endpoint, lifetime, refresh: UNVERIFIED.

## 3. Environments

- Production API host: `https://cpg.torobpay.com` (SNIPPET, official plugin description — "default host"). Path prefix: UNVERIFIED.
- Sandbox/test host: UNVERIFIED (no mention in any reachable text).
- Sandbox credentials: UNVERIFIED (the plugin mentions "credential fetch ... for your account" and "provision or refresh merchant credentials", suggesting credentials are provisioned through the merchant panel).

## 4. Create payment

Flow reported by third-party summaries (UNVERIFIED): OAuth token → create payment (payment token) → redirect customer to a TorobPay hosted page → verify → separate settle/reversal/cancel calls. Plugin description (SNIPPET) confirms operations: "create/update payments, check payment status, sync order details".

- Endpoint paths, HTTP methods: UNVERIFIED (none published).
- Request fields: the plugin sends "order identifiers, amounts, currency, line items, discounts and status, customer contact fields required for payment, ... site/store context needed for callbacks" (SNIPPET). Exact field names: UNVERIFIED.
- Amount unit: UNVERIFIED ("currency" is sent per the plugin description; whether the API expects IRR or toman is not published).
- Transaction identifier (payment token / id): UNVERIFIED.
- Redirect URL pattern: UNVERIFIED.
- Product: "customers can pay in installments at checkout"; third-party summaries describe four instalments with the merchant paid in full (UNVERIFIED).

## 5. Callback

- Method and parameter names: UNVERIFIED. Plugin sends "site/store context needed for callbacks" (SNIPPET), implying a merchant-provided callback URL.
- Cancel detection: UNVERIFIED.

## 6. Verification

- Endpoint/body/response/idempotency/time limit: UNVERIFIED.

## 7. Settlement / capture

- A separate settle step is described by third-party summaries only (UNVERIFIED).

## 8. Refund / reverse / cancel

- The official plugin "supports refunds" and "order status sync" (SNIPPET) — so a refund/cancel API exists. Endpoints, partial refund support, and time constraints: UNVERIFIED.

## 9. Inquiry / status endpoint

- The plugin "check[s] payment status" (SNIPPET) — a status endpoint exists. Path and response: UNVERIFIED.

## 10. Error code table

- NOT DOCUMENTED in any reachable official source.

## 11. Signature / HMAC / IP whitelist

- UNVERIFIED. No official statement found.

## 12. Known limitations and implementation notes

- Official plugin facts (SNIPPET): supports classic and block-based WooCommerce checkout, HPOS, order-status sync, refunds, in-store QR payments, product-page installment widgets and an optional discount-code widget; last release 2026-09-25; 100+ active installs.
- Because the plugin is GPL/open-source ("TorobPay for WooCommerce is open source software"), its source on plugins.svn.wordpress.org is the most authoritative public description of the API contract — retrieve it from an unrestricted network and treat it as the reference until TorobPay supplies documentation.
- Design the integration as a configurable adapter (base URL, paths, field names, amount unit) and gate go-live on a contract-supplied document.
- Idempotency and duplicate callbacks: UNVERIFIED — implement idempotent handling by provider transaction id regardless.

## 13. Could NOT be verified from official sources (checklist)

- [ ] Any endpoint path or HTTP method.
- [ ] Credential names, token endpoint, grant type, token lifetime.
- [ ] Sandbox existence and base URL.
- [ ] Request/response schemas for create, verify, settle, refund, cancel, status.
- [ ] Amount unit and limits.
- [ ] Callback method, parameters, cancel signalling.
- [ ] Error codes.
- [ ] Signature / IP whitelist requirements.
- [ ] Whether the WordPress.org plugin is published by TorobPay itself (author not retrievable).
- [ ] Whether `pay.torob.com` exists.

Action required: obtain merchant credentials and the technical document from TorobPay (panel.torobpay.com) and/or read the WooCommerce plugin source from plugins.svn.wordpress.org on an unrestricted network.
