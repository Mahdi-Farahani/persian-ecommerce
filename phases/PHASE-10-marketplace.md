# Phase 10 — Seller Marketplace

## Objective

Transform the single-store architecture into a multi-seller marketplace.

---

## Seller

Implement:

* seller application
* seller profile
* seller status
* seller dashboard

---

## Seller Products

Support:

```text
Product
   ↓
Multiple Sellers
```

Each seller may define:

* price
* inventory
* SKU
* fulfillment information

---

## Seller Orders

Seller should only see authorized order items.

---

## Settlements

Create settlement architecture.

Track:

* gross amount
* platform commission
* seller amount
* settlement status

Do not implement real banking integration unless explicitly required.

---

## Admin

Admin can:

* approve seller
* suspend seller
* view seller products
* view seller orders
* manage commissions

---

## Tests

Test tenant/data isolation between sellers.

Commit:

```text
feat: implement seller marketplace
```

Push to development.
