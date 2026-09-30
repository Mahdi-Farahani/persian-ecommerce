# Testing Strategy

## Testing Pyramid

```text
             E2E
          /       \
      Integration
       /           \
       Unit Tests
```

---

# 1. Unit Tests

Test:

* services
* pricing calculations
* discount calculations
* inventory calculations
* validation
* authentication logic
* authorization
* order state transitions

---

# 2. Integration Tests

Test:

* database interactions
* repositories
* authentication
* cart
* checkout
* orders
* payments
* inventory

---

# 3. E2E Tests

Critical flows:

## Registration

```text
Register
→ Login
→ Profile
```

## Shopping

```text
Browse
→ Product
→ Variant
→ Cart
→ Checkout
```

## Payment

```text
Checkout
→ Payment
→ Verification
→ Order
```

## Order

```text
Order
→ Processing
→ Shipment
→ Delivery
```

## Review

```text
Purchase
→ Delivered
→ Review
```

---

# 4. Frontend Tests

Test:

* components
* forms
* validation
* cart interactions
* authentication
* checkout
* responsive behavior where practical

---

# 5. Required Checks

Before considering any phase complete:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Exact commands may differ depending on package manager and project setup.

Use the actual scripts defined in `package.json`.

---

# 6. Docker Verification

Run:

```bash
docker compose build
docker compose up -d
```

Then verify:

```text
frontend reachable
backend reachable
database healthy
nginx healthy
health endpoint works
```

Run smoke tests against the running environment.

---

# 7. Failure Policy

Never delete a failing test merely to make CI green.

Never weaken assertions without documented justification.

Always identify the root cause.

---

# 8. Test Data

Provide deterministic seed data.

Tests must not depend on production data.

---

# 9. Regression Testing

When fixing a bug:

1. reproduce it
2. create a regression test
3. fix it
4. run the test
5. run the complete relevant test suite

---

# 10. Completion Standard

A phase is complete only when all applicable checks pass.
