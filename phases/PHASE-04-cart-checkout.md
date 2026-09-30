# Phase 04 — Cart and Checkout

## Objective

Implement the complete shopping cart and checkout flow.

---

## Cart

Implement:

* guest cart
* authenticated cart
* cart merge
* add
* remove
* quantity update
* price validation
* inventory validation

---

## Checkout

Implement:

```text
Cart
→ Address
→ Shipping
→ Coupon
→ Price calculation
→ Inventory validation
→ Payment initialization
```

---

## Frontend

Implement complete responsive checkout UX.

---

## Important

Never trust frontend totals.

Backend must calculate:

```text
subtotal
discount
shipping
tax if applicable
final total
```

---

## Tests

Test:

* guest cart
* login cart merge
* inventory shortage
* price changes
* coupon
* checkout validation
* concurrent inventory conditions

Commit:

```text
feat: implement cart and checkout
```

Push to development.
