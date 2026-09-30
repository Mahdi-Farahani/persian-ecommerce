# API Specification

Base URL:

```text
/api/v1
```

Swagger:

```text
/api/docs
```

---

# Authentication

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
POST /auth/forgot-password
POST /auth/reset-password
GET  /auth/me
```

---

# Users

```text
GET    /users/me
PATCH  /users/me
GET    /users/me/addresses
POST   /users/me/addresses
PATCH  /users/me/addresses/:id
DELETE /users/me/addresses/:id
```

---

# Products

```text
GET    /products
GET    /products/:id
POST   /products
PATCH  /products/:id
DELETE /products/:id
```

Filters should support:

```text
category
brand
minPrice
maxPrice
availability
attributes
seller
sort
page
limit
search
```

---

# Categories

```text
GET    /categories
GET    /categories/:slug
POST   /categories
PATCH  /categories/:id
DELETE /categories/:id
```

---

# Brands

```text
GET    /brands
GET    /brands/:id
POST   /brands
PATCH  /brands/:id
DELETE /brands/:id
```

---

# Cart

```text
GET    /cart
POST   /cart/items
PATCH  /cart/items/:id
DELETE /cart/items/:id
DELETE /cart
```

---

# Wishlist

```text
GET    /wishlist
POST   /wishlist/:productId
DELETE /wishlist/:productId
```

---

# Checkout

```text
POST /checkout/validate
POST /checkout
```

Checkout must recalculate:

* prices
* discounts
* inventory
* shipping
* totals

on the server.

---

# Orders

```text
GET /orders
GET /orders/:id
POST /orders/:id/cancel
```

Admin:

```text
GET   /admin/orders
PATCH /admin/orders/:id/status
```

---

# Payments

```text
POST /payments
POST /payments/:id/verify
POST /payments/callback
GET  /payments/:id
```

Payment provider callbacks must be verified.

---

# Reviews

```text
GET    /products/:productId/reviews
POST   /products/:productId/reviews
PATCH  /reviews/:id
DELETE /reviews/:id
```

Admin moderation:

```text
GET   /admin/reviews
PATCH /admin/reviews/:id/status
```

---

# Admin

Admin APIs should cover:

```text
/users
/products
/categories
/brands
/orders
/inventory
/sellers
/coupons
/discounts
/reviews
/reports
/audit-logs
```

---

# Sellers

```text
POST /seller/apply
GET  /seller/profile
GET  /seller/products
POST /seller/products
PATCH /seller/products/:id
GET  /seller/orders
GET  /seller/inventory
GET  /seller/settlements
```

---

# API Standards

All endpoints must:

* validate input
* authenticate when required
* authorize based on permissions
* return appropriate HTTP status
* use consistent errors
* be documented in Swagger

Pagination should use a consistent structure.

Example:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

# As-built endpoint reference

Base URL `/api/v1`. Errors use `{ success: false, error: { code, message, details? } }`.
Authentication: `Authorization: Bearer <accessToken>` **or** the httpOnly
cookies `pe_access` / `pe_refresh` set by the auth endpoints. Cookie-based
state-changing requests must send `X-Requested-With` (CSRF protection).

## Auth (`/auth`)

| Method | Path                     | Auth   | Notes |
| ------ | ------------------------ | ------ | ----- |
| POST   | `/auth/register`         | public | email or phone + password; returns user + tokens, sets cookies |
| POST   | `/auth/login`            | public | `identifier` (email/mobile) + `password`; lockout after repeated failures (423) |
| POST   | `/auth/refresh`          | public | rotates refresh token (cookie or body); reuse outside a 30 s grace window revokes the session family |
| POST   | `/auth/logout`           | public | revokes current session, clears cookies |
| POST   | `/auth/logout-all`       | user   | revokes every session |
| GET    | `/auth/me`               | user   | current principal (roles + permissions) |
| POST   | `/auth/change-password`  | user   | revokes other sessions |
| POST   | `/auth/forgot-password`  | public | always 200; sends reset link via notification provider |
| POST   | `/auth/reset-password`   | public | one-time token; revokes all sessions |
| POST   | `/auth/verification/request` | user | sends 6-digit code (EMAIL/PHONE) |
| POST   | `/auth/verification/confirm` | user | max 5 attempts per code |

## Users (`/users/me`)

| Method | Path                         | Notes |
| ------ | ---------------------------- | ----- |
| GET    | `/users/me`                  | profile |
| PATCH  | `/users/me`                  | firstName / lastName |
| GET    | `/users/me/addresses`        | default first |
| POST   | `/users/me/addresses`        | max 10; first becomes default |
| GET    | `/users/me/addresses/:id`    | owner only |
| PATCH  | `/users/me/addresses/:id`    | owner only |
| DELETE | `/users/me/addresses/:id`    | owner only; promotes another default |

## Admin users & RBAC (`/admin`)

| Method | Path                        | Permission     |
| ------ | --------------------------- | -------------- |
| GET    | `/admin/users`              | `users.view`   |
| GET    | `/admin/users/:id`          | `users.view`   |
| PATCH  | `/admin/users/:id/status`   | `users.manage` (audited) |
| PATCH  | `/admin/users/:id/roles`    | `users.manage`; granting ADMIN/SUPER_ADMIN or touching privileged accounts requires `roles.manage` (audited) |
| GET    | `/admin/roles`              | `users.view`   |
| GET    | `/admin/permissions`        | `users.view`   |

Permission keys are defined in `apps/api/src/rbac/permissions.ts`.
