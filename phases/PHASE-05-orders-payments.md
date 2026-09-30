# PHASE 05 — Payment Gateway Integration

## Objective

Implement a production-ready, provider-agnostic Iranian payment architecture and integrate the following payment providers:

1. ZarinPal
2. SnappPay
3. DigiPay
4. TorobPay

The implementation MUST NOT be tightly coupled to any single provider.

The system must support:

* Multiple payment providers
* Enabling/disabling providers
* Selecting the default provider
* Provider-specific configuration
* Provider-specific credentials
* Secure credential storage
* Payment initiation
* Redirect / SDK / checkout flow according to each provider
* Callback handling
* Payment verification
* Payment settlement/finalization
* Payment failure handling
* Cancellation/expiration handling
* Idempotency
* Transaction tracking
* Payment reconciliation
* Admin management of payment providers
* Sandbox/test mode where supported
* Production mode
* Mock payment provider for automated tests

---

# 5.1 Mandatory Documentation Research

Before writing payment integration code, the implementation agent MUST research and read the latest official documentation for:

* ZarinPal
* SnappPay
* DigiPay
* TorobPay

Do NOT rely solely on:

* Blog posts
* StackOverflow
* GitHub examples
* Old npm packages
* Old Laravel/PHP packages
* Unofficial SDKs
* Random tutorials
* Cached examples

Official provider documentation is the source of truth.

For each provider, determine and document:

### Authentication

Identify exactly what the provider requires, such as:

* Merchant ID
* Merchant Code
* API Key
* Client ID
* Client Secret
* Terminal ID
* Username/password
* OAuth credentials
* Signature
* HMAC secret
* JWT credentials
* Any other credential

Do not assume that all providers use the same authentication mechanism.

### Payment Creation

Document:

* Request URL
* HTTP method
* Required headers
* Authentication method
* Request body
* Required fields
* Optional fields
* Amount format
* Currency
* Order/reference ID
* Callback URL
* Description
* Customer information
* Mobile number requirements
* Invoice/order metadata
* Sandbox endpoint
* Production endpoint

### Payment Response

Document:

* Success response
* Failure response
* Payment token
* Authority
* Transaction ID
* Reference ID
* Status codes
* Error codes
* Redirect URL
* Any provider-specific fields

### Callback

Determine exactly how the provider returns the customer:

* GET
* POST
* Query parameters
* Form body
* JSON
* Signed payload
* Token
* Authority
* Transaction ID

Never guess the callback format.

### Verification

Determine:

* Verification endpoint
* HTTP method
* Required credentials
* Required parameters
* Successful verification response
* Failed verification response
* Already-verified response
* Duplicate verification behavior
* Error codes

### Settlement / Finalization

If the provider has a separate settlement or inquiry process, document and implement it.

### Refund / Reverse

Determine whether the provider supports:

* Refund
* Reverse
* Cancellation
* Chargeback inquiry

If supported by the official API, implement it behind the common payment interface.

If not supported, explicitly document that capability as unsupported.

---

# 5.2 Provider Architecture

Create a provider abstraction.

Example conceptual interface:

```typescript
interface PaymentProvider {
  readonly name: PaymentProviderName;

  createPayment(
    request: CreatePaymentRequest,
  ): Promise<CreatePaymentResult>;

  verifyPayment(
    request: VerifyPaymentRequest,
  ): Promise<VerifyPaymentResult>;

  settlePayment?(
    request: SettlePaymentRequest,
  ): Promise<SettlePaymentResult>;

  refundPayment?(
    request: RefundPaymentRequest,
  ): Promise<RefundPaymentResult>;

  inquiryPayment?(
    request: InquiryPaymentRequest,
  ): Promise<InquiryPaymentResult>;
}
```

The exact interface may be adjusted according to the real capabilities discovered in the official documentation.

Providers:

```text
ZarinPalPaymentProvider
SnappPayPaymentProvider
DigiPayPaymentProvider
TorobPayPaymentProvider
MockPaymentProvider
```

The business logic must NEVER directly call:

```text
ZarinPal API
SnappPay API
DigiPay API
TorobPay API
```

from order/checkout services.

Instead:

```text
CheckoutService
      ↓
PaymentService
      ↓
PaymentProviderFactory
      ↓
Selected PaymentProvider
      ↓
Provider API
```

---

# 5.3 Payment Provider Registry

Create a database-backed provider registry.

Example:

```text
PaymentProviderConfig

id
provider
displayName
enabled
isDefault
environment
credentialsEncrypted
configurationEncrypted
createdAt
updatedAt
```

Provider enum:

```text
ZARINPAL
SNAPP_PAY
DIGIPAY
TOROB_PAY
MOCK
```

Environment:

```text
SANDBOX
PRODUCTION
```

The exact provider names can be adjusted if the official API/documentation uses a different naming convention.

---

# 5.4 Credentials and Configuration

Credentials MUST NOT be hard-coded.

Examples:

```text
ZARINPAL_MERCHANT_ID
ZARINPAL_API_KEY

SNAPP_PAY_CLIENT_ID
SNAPP_PAY_CLIENT_SECRET

DIGIPAY_CLIENT_ID
DIGIPAY_CLIENT_SECRET

TOROB_PAY_API_KEY
TOROB_PAY_MERCHANT_ID
```

These are examples only.

The implementation agent MUST NOT invent credentials based on these examples.

The actual required variables must be determined from the official documentation.

---

# 5.5 Environment Variables

Support environment-based configuration.

Example:

```env
PAYMENT_ENCRYPTION_KEY=

ZARINPAL_ENABLED=false
ZARINPAL_ENVIRONMENT=sandbox

SNAPP_PAY_ENABLED=false
SNAPP_PAY_ENVIRONMENT=sandbox

DIGIPAY_ENABLED=false
DIGIPAY_ENVIRONMENT=sandbox

TOROB_PAY_ENABLED=false
TOROB_PAY_ENVIRONMENT=sandbox
```

Provider-specific credentials may be represented through environment variables.

However, the architecture MUST also support credentials/configuration stored in the Admin Panel.

Environment variables should be treated as bootstrap/default configuration.

---

# 5.6 Admin Payment Configuration

Add:

```text
Admin → Settings → Payment Gateways
```

The admin must be able to manage:

### ZarinPal

* Enabled/Disabled
* Environment
* Merchant/API credentials required by the official API
* Callback configuration if applicable
* Additional provider settings

### SnappPay

* Enabled/Disabled
* Environment
* Required credentials
* Additional configuration

### DigiPay

* Enabled/Disabled
* Environment
* Required credentials
* Additional configuration

### TorobPay

* Enabled/Disabled
* Environment
* Required credentials
* Additional configuration

The UI MUST dynamically display the fields required by each provider.

Do not show irrelevant credential fields.

For example:

```text
ZarinPal
--------------------------
Merchant ID
API Key
Environment
Enabled

Save
Test Connection
```

---

# 5.7 Secret Storage

Payment credentials are sensitive.

NEVER store secrets as plain text in the database.

Implement encryption at rest.

Example:

```text
Database
    ↓
Encrypted credentials
    ↓
PaymentProviderConfig
```

The encryption key MUST come from an environment variable:

```env
PAYMENT_ENCRYPTION_KEY=
```

The key MUST NOT be stored in the database.

The Admin Panel must never return secrets in API responses.

For example, instead of:

```json
{
  "apiKey": "real-secret-value"
}
```

return:

```json
{
  "apiKey": "••••••••••••"
}
```

If an admin edits a credential without changing it, preserve the existing encrypted value.

---

# 5.8 Admin Payment Gateway UI

Create:

```text
/admin/settings/payment-gateways
```

Page requirements:

* Provider cards
* Enable/disable switch
* Default provider selection
* Environment selector
* Configuration form
* Secret masking
* Save
* Test connection
* Test payment where supported
* Provider status
* Last successful connection test
* Last configuration update
* Error state
* Validation state

Example:

```text
Payment Gateways

┌───────────────────────────────────┐
│ ZarinPal                          │
│ Status: Enabled                   │
│ Environment: Production           │
│                                   │
│ Merchant ID: •••••••••••          │
│ API Key:     •••••••••••          │
│                                   │
│ [Test Connection] [Edit]          │
└───────────────────────────────────┘
```

---

# 5.9 Default Provider

The system must support one default provider.

Example:

```text
Default:
ZarinPal
```

If the default provider is disabled, payment creation must NOT silently fail.

The system should:

1. Detect that the default provider is unavailable.
2. Find another enabled provider if fallback is explicitly configured.
3. Otherwise return a clear payment-provider-unavailable error.

Do not automatically switch providers unless the system explicitly supports a fallback policy.

---

# 5.10 Payment Selection

The checkout flow must support:

```text
Checkout
   ↓
Payment Method
   ↓
Available Providers
   ↓
Selected Provider
   ↓
Payment Creation
```

The frontend must obtain available providers from the backend.

Do NOT hard-code:

```typescript
const gateways = [
  "zarinpal",
  "snapp-pay",
];
```

in the frontend.

The backend determines which providers are currently available.

---

# 5.11 Payment Database Model

Extend the payment schema.

Minimum conceptual structure:

```text
Payment

id
orderId
provider
providerTransactionId
providerAuthority
amount
currency
status
requestId
referenceId
callbackPayload
verificationPayload
createdAt
updatedAt
verifiedAt
```

Potential status values:

```text
INITIATED
REDIRECTED
CALLBACK_RECEIVED
VERIFYING
PAID
FAILED
CANCELLED
EXPIRED
REFUNDED
```

The exact states can be refined according to the provider behavior.

---

# 5.12 Payment Attempts

A single order may have multiple payment attempts.

Do NOT assume:

```text
Order → Payment
```

is always one-to-one.

Support:

```text
Order
  ├── PaymentAttempt #1 → failed
  ├── PaymentAttempt #2 → expired
  └── PaymentAttempt #3 → successful
```

This is important for real production behavior.

Create a payment-attempt model if required by the final schema.

Track:

* Provider
* Amount
* Attempt number
* Provider token
* Authority
* Transaction ID
* Status
* Error code
* Error message
* Created timestamp
* Callback timestamp
* Verification timestamp

---

# 5.13 Idempotency

Payment operations MUST be idempotent.

Particularly:

```text
create payment
callback
verify
settle
```

The same callback may arrive multiple times.

Example:

```text
Callback
   ↓
Payment already PAID?
   ↓
YES
   ↓
Return successful response
```

Do NOT create duplicate orders.

Do NOT increase inventory multiple times.

Do NOT mark an order as paid multiple times.

Do NOT generate duplicate financial transactions.

---

# 5.14 Payment Verification

Never trust the browser redirect as proof of payment.

The flow must be:

```text
Customer
   ↓
Provider
   ↓
Callback
   ↓
Backend
   ↓
Verify with Provider API
   ↓
Provider confirms payment
   ↓
Mark Payment PAID
   ↓
Finalize Order
```

The backend must verify the transaction directly with the provider.

---

# 5.15 Order Finalization

Payment verification must happen inside a safe transactional workflow.

Conceptually:

```text
Verify Payment
      ↓
Provider confirms payment
      ↓
Database transaction
      ├── Mark payment PAID
      ├── Mark order PAID
      ├── Confirm inventory reservation
      ├── Create payment transaction
      ├── Create order status history
      └── Emit order/payment event
```

The exact transaction boundaries must be designed carefully.

Never perform irreversible financial state changes before provider verification.

---

# 5.16 Amount Handling

All monetary values must be handled as integers.

Never use floating-point numbers for money.

For every provider document:

```text
Internal amount
       ↓
Provider-specific amount conversion
       ↓
Provider API
```

The adapter must handle provider-specific:

* Rial/Toman differences
* Integer/decimal formats
* Minor units
* Currency codes

Do NOT scatter conversion logic throughout the application.

Create a provider-specific amount adapter/helper.

---

# 5.17 Callback Security

Callback endpoints must be treated as untrusted input.

Validate:

* Provider token
* Authority
* Transaction ID
* Order reference
* Amount
* Signature
* HMAC
* Provider-specific authentication data

according to the official provider documentation.

Never mark payment as successful merely because:

```text
status=success
```

was received from the browser.

---

# 5.18 Provider-Specific Callback Routes

Prefer a clear architecture such as:

```text
/api/v1/payments/zarinpal/callback
/api/v1/payments/snapp-pay/callback
/api/v1/payments/digipay/callback
/api/v1/payments/torob-pay/callback
```

However, if a provider requires a specific callback URL format, implement that exact format.

Do not force all providers into an incompatible callback contract.

---

# 5.19 Payment API

Implement APIs similar to:

```text
GET    /api/v1/payments/providers
POST   /api/v1/payments/create
GET    /api/v1/payments/:id
POST   /api/v1/payments/:id/verify
POST   /api/v1/payments/:id/refund
GET    /api/v1/payments/:id/status
```

Provider callbacks:

```text
GET/POST /api/v1/payments/zarinpal/callback
GET/POST /api/v1/payments/snapp-pay/callback
GET/POST /api/v1/payments/digipay/callback
GET/POST /api/v1/payments/torob-pay/callback
```

The exact callback methods must match official provider documentation.

---

# 5.20 Admin APIs

Create admin-only APIs for:

```text
GET    /api/v1/admin/payment-gateways

GET    /api/v1/admin/payment-gateways/:provider

PATCH  /api/v1/admin/payment-gateways/:provider

POST   /api/v1/admin/payment-gateways/:provider/test

POST   /api/v1/admin/payment-gateways/:provider/test-payment
```

Only authorized administrators may access these APIs.

---

# 5.21 Payment Provider Permissions

Introduce granular permissions.

Examples:

```text
payment_gateway.view
payment_gateway.update
payment_gateway.test
payment.view
payment.refund
payment.reconcile
```

Do not rely only on:

```text
role === ADMIN
```

for sensitive operations.

---

# 5.22 Payment Logs

Create structured payment logs.

Log:

```text
provider
paymentId
orderId
operation
requestId
providerTransactionId
status
duration
errorCode
```

Never log:

* API secrets
* Client secrets
* Authorization tokens
* Full customer credentials
* Sensitive payment credentials

Mask sensitive fields.

---

# 5.23 Payment Reconciliation

Implement a reconciliation mechanism where supported.

Admin should be able to inspect:

```text
Order
Payment
Provider Transaction
Verification Status
```

If the provider supports inquiry APIs, expose them through:

```text
POST /api/v1/admin/payments/:id/reconcile
```

The reconciliation operation must query the provider and synchronize the internal payment state safely.

Never allow reconciliation to arbitrarily mark a payment as paid without provider confirmation.

---

# 5.24 Mock Payment Provider

Create:

```text
MockPaymentProvider
```

for automated tests and local development.

It must support:

```text
create
callback
verify
success
failure
duplicate callback
already verified
expired payment
```

This avoids depending on external payment systems for CI.

---

# 5.25 Sandbox Support

Where the official provider supports sandbox/test mode:

```text
SANDBOX
PRODUCTION
```

must be supported.

Never accidentally send test transactions to production.

Make the environment clearly visible in the Admin Panel.

Example:

```text
⚠ Production
```

versus:

```text
Test / Sandbox
```

Production configuration should require explicit confirmation before saving where appropriate.

---

# 5.26 Frontend Checkout

Checkout UI must support the available providers.

Example:

```text
روش پرداخت

○ زرین‌پال
  پرداخت آنلاین

○ اسنپ‌پی
  پرداخت با سرویس اسنپ‌پی

○ دیجی‌پی
  پرداخت آنلاین

○ ترب‌پی
  پرداخت با ترب‌پی
```

The actual descriptions and branding must follow each provider's allowed usage guidelines.

The frontend must not contain provider credentials.

---

# 5.27 Payment Result Pages

Implement:

```text
/payment/success
/payment/failure
/payment/pending
```

The result page must query backend payment status.

Do NOT determine payment success purely from URL parameters.

Example:

```text
Browser
   ↓
/payment/result?paymentId=...
   ↓
Backend
   ↓
Payment status
```

---

# 5.28 Failure Handling

Handle:

* User cancellation
* Provider rejection
* Insufficient balance
* Expired transaction
* Timeout
* Network failure
* Provider API failure
* Verification failure
* Duplicate callback
* Already-paid transaction
* Invalid callback
* Invalid authority/token
* Amount mismatch
* Unknown provider error

Map provider-specific errors into normalized internal errors while preserving the original provider error code for diagnostics.

---

# 5.29 Retry Strategy

Retries must be carefully controlled.

Safe retry candidates may include:

* Provider inquiry
* Verification when the provider explicitly supports retry
* Temporary network errors

Do NOT blindly retry payment creation because this may create multiple payment transactions.

Use:

```text
requestId
idempotency key
provider reference
payment attempt
```

to prevent duplicate transactions.

---

# 5.30 Security Requirements

Payment integration is security-sensitive.

Implement:

* HTTPS in production
* Server-side credential storage
* Encryption of stored credentials
* RBAC
* Permission checks
* Input validation
* Callback validation
* Provider verification
* Idempotency
* Rate limiting
* Audit logging
* Secure cookies where applicable
* CORS restrictions
* Security headers
* No secrets in Git
* No secrets in logs
* No secrets in frontend bundles
* No sensitive provider credentials in API responses

---

# 5.31 Audit Log

Every sensitive Admin payment configuration action must create an audit log.

Examples:

```text
Payment provider enabled
Payment provider disabled
Default provider changed
Provider credentials updated
Provider environment changed
Provider test executed
Payment manually reconciled
Payment refunded
```

Store:

```text
actor
action
provider
timestamp
IP if appropriate
metadata
```

Never store raw secrets inside the audit log.

---

# 5.32 Testing Requirements

Every provider adapter must have tests.

Minimum:

### Unit Tests

Test:

```text
request generation
authentication
amount conversion
response parsing
success mapping
error mapping
callback parsing
verification parsing
```

### Integration Tests

Test:

```text
PaymentService
ProviderFactory
database persistence
payment attempt creation
idempotency
order finalization
```

### E2E Tests

At minimum:

```text
Customer
  ↓
Add product
  ↓
Cart
  ↓
Checkout
  ↓
Select provider
  ↓
Create payment
  ↓
Mock provider
  ↓
Callback
  ↓
Verify
  ↓
Order PAID
```

Test every provider through its adapter using mocks/stubs where external sandbox access is unavailable.

---

# 5.33 Provider Contract Tests

Create a common test suite that every provider must satisfy.

For example:

```text
PaymentProviderContractSuite
```

Every provider must pass:

```text
✓ create payment
✓ invalid credentials
✓ provider error
✓ callback parsing
✓ successful verification
✓ failed verification
✓ duplicate verification
✓ duplicate callback
✓ amount mismatch
✓ transaction mismatch
```

This prevents provider implementations from behaving differently in dangerous ways.

---

# 5.34 Documentation

Create:

```text
docs/payments/
```

with:

```text
README.md
ZARINPAL.md
SNAPP-PAY.md
DIGIPAY.md
TOROB-PAY.md
PAYMENT-ARCHITECTURE.md
PAYMENT-SECURITY.md
PAYMENT-RECONCILIATION.md
```

Each provider document must contain:

```text
Official documentation source
Last documentation review date
Authentication
Endpoints
Sandbox
Production
Create payment
Callback
Verification
Refund/reverse
Error codes
Required credentials
Environment variables
Admin configuration
Known limitations
Implementation notes
```

If an official provider document is unavailable, clearly document that fact and do not invent API behavior.

---

# 5.35 Documentation Verification Rule

Before considering this phase complete, the implementation agent MUST verify that the code matches the current official documentation for all four providers.

For each provider produce an internal checklist:

```text
[ ] Official docs located
[ ] Authentication verified
[ ] Create-payment API verified
[ ] Callback verified
[ ] Verification API verified
[ ] Amount/currency verified
[ ] Error codes verified
[ ] Sandbox verified
[ ] Production endpoint verified
[ ] Required credentials verified
[ ] Refund/reverse capability verified
[ ] Implementation matches docs
[ ] Tests added
```

Do not mark a provider as complete without satisfying this checklist.

---

# 5.36 Definition of Done

This phase is complete only when:

### Architecture

* [ ] Provider abstraction implemented
* [ ] Provider factory implemented
* [ ] Provider registry implemented
* [ ] Payment attempts supported
* [ ] Idempotency implemented

### Providers

* [ ] ZarinPal implemented
* [ ] SnappPay implemented
* [ ] DigiPay implemented
* [ ] TorobPay implemented
* [ ] Mock provider implemented

### Admin

* [ ] Payment Gateway settings page implemented
* [ ] Enable/disable implemented
* [ ] Default provider implemented
* [ ] Environment selection implemented
* [ ] Provider-specific credential forms implemented
* [ ] Secrets masked
* [ ] Secrets encrypted at rest
* [ ] Test connection implemented where technically possible
* [ ] Permissions implemented
* [ ] Audit logs implemented

### Checkout

* [ ] Provider selection implemented
* [ ] Payment creation implemented
* [ ] Redirect/checkout implemented
* [ ] Callback implemented
* [ ] Verification implemented
* [ ] Success/failure/pending states implemented

### Security

* [ ] No secrets in Git
* [ ] No secrets in frontend
* [ ] No secrets in logs
* [ ] Callback validation implemented
* [ ] Server-side verification implemented
* [ ] Idempotency implemented
* [ ] RBAC implemented
* [ ] Audit logging implemented

### Testing

* [ ] Unit tests
* [ ] Provider contract tests
* [ ] Integration tests
* [ ] E2E tests
* [ ] Mock payment flow
* [ ] Duplicate callback test
* [ ] Duplicate verification test
* [ ] Amount mismatch test
* [ ] Provider failure test

### Documentation

* [ ] Payment architecture documented
* [ ] ZarinPal documentation reviewed
* [ ] SnappPay documentation reviewed
* [ ] DigiPay documentation reviewed
* [ ] TorobPay documentation reviewed
* [ ] Provider configuration documented
* [ ] Deployment configuration documented

### Quality

* [ ] ESLint passes
* [ ] TypeScript passes
* [ ] Unit tests pass
* [ ] Integration tests pass
* [ ] E2E tests pass
* [ ] Frontend builds
* [ ] Backend builds
* [ ] Docker build succeeds
* [ ] Docker Compose starts successfully

---

# 5.37 Git

After successful implementation:

```bash
git status
git diff
git log
```

Create a conventional commit, for example:

```text
feat(payments): integrate Iranian payment gateways
```

Then push directly to:

```text
origin/development
```

Do NOT create a PR.

Do NOT create a separate feature branch unless explicitly instructed.

---

# 5.38 Important Implementation Principle

Do not implement these providers as four unrelated pieces of code.

The final architecture should look like:

```text
                    ┌──────────────────────┐
                    │      Checkout        │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   PaymentService     │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ PaymentProviderFactory│
                    └──────────┬───────────┘
                               │
          ┌────────────────────┼─────────────────────┐
          │                    │                     │
          ▼                    ▼                     ▼
   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
   │  ZarinPal   │      │  SnappPay   │      │   DigiPay   │
   └─────────────┘      └─────────────┘      └─────────────┘
                                                   │
                                                   │
                                             ┌─────────────┐
                                             │  TorobPay   │
                                             └─────────────┘

                    + MockPaymentProvider
```

The business layer should know nothing about provider-specific HTTP APIs.

Only the adapter should know those details.

This allows a new Iranian payment provider to be added later without rewriting checkout/order logic.

---

# Final Phase Requirement

The implementation agent MUST NOT simply say:

> "Payment gateways are integrated."

It must provide a final implementation report containing:

```text
Provider
Documentation reviewed
Authentication method
Implemented APIs
Sandbox support
Production support
Credentials required
Admin configuration fields
Callback implementation
Verification implementation
Refund/reverse support
Tests
Known limitations
```

The final report must distinguish between:

```text
IMPLEMENTED
NOT SUPPORTED BY PROVIDER
NOT AVAILABLE IN SANDBOX
REQUIRES PRODUCTION CREDENTIALS
```

Never claim a provider capability that was not verified against its official documentation.
