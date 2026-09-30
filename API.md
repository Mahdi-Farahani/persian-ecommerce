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

## Catalog (public)

| Method | Path                     | Notes |
| ------ | ------------------------ | ----- |
| GET    | `/categories`            | active category tree |
| GET    | `/categories/:slug`      | breadcrumb, active children, filterable attributes (inherited from ancestors) |
| GET    | `/brands`                | active brands |
| GET    | `/brands/:slug`          | brand with public product count |
| GET    | `/products`              | filters: `category` (slug, includes sub-categories), `brand` (comma list), `minPrice`/`maxPrice` (IRR), `inStock`, `attr[<slug>]=<valueSlug,...>`, `q`, `sort` (`newest`, `price_asc`, `price_desc`, `popular`, `rating`), `page`, `limit` |
| GET    | `/products/:slug`        | detail: images, active variants with availability, variant attributes, specifications, breadcrumb |
| GET    | `/uploads/*`             | stored images (immutable, served by the API; proxied by nginx and by a Next.js rewrite) |

Only products with status `ACTIVE` or `OUT_OF_STOCK` are public. Prices are integers in IRR.

## Catalog (admin, `catalog.view` / `catalog.manage`)

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET/POST | `/admin/products` | list (all statuses, search by title/slug/SKU) / create with variants, attributes, specifications, images |
| GET/PATCH/DELETE | `/admin/products/:id` | detail (incl. inactive variants) / update fields, attributes, specifications / delete |
| PATCH | `/admin/products/:id/status` | lifecycle status (ACTIVE requires an active variant) |
| POST | `/admin/products/:id/variants` | add variant (`initialStock` creates a PURCHASE ledger entry) |
| PATCH/DELETE | `/admin/variants/:variantId` | update / delete (a product keeps ≥ 1 variant) |
| POST | `/admin/products/:id/images` | attach uploaded image |
| PUT | `/admin/products/:id/images/order` | reorder |
| PATCH/DELETE | `/admin/product-images/:imageId` | update metadata / remove |
| POST | `/admin/uploads/images` | multipart `file`; validated with sharp, re-encoded to WebP ≤ 1600px, metadata stripped |
| GET | `/admin/categories`, `/admin/categories/tree`, `/admin/categories/:id` | flat list / tree incl. inactive / detail |
| POST/PATCH/DELETE | `/admin/categories[/:id]` | create / update (re-parenting rewrites the subtree path; cycles rejected) / delete empty |
| GET/POST/PATCH/DELETE | `/admin/brands[/:id]` | paginated list / CRUD (delete only when unused) |
| GET/POST/PATCH/DELETE | `/admin/attributes[/:id]` | CRUD with values (`values` replaces the list; values in use cannot be removed) |
| GET | `/admin/inventory/:variantId` | snapshot (`inventory.view`) |
| GET | `/admin/inventory/:variantId/transactions` | ledger |
| PATCH | `/admin/inventory/:variantId/adjust` | signed quantity, type ADJUSTMENT/PURCHASE/RETURN (`inventory.manage`, audited) |
| PATCH | `/admin/inventory/:variantId/threshold` | low-stock threshold |

All admin mutations write an audit log entry.

## Cart (guest or user; `@OptionalAuth`)

Guests get an httpOnly `pe_cart` cookie on their first write. On login or
registration the guest cart is merged into the user's cart (quantities summed
and capped). Totals are always recomputed server side from current prices and
availability; unsellable lines are excluded from totals and reported in
`warnings`.

| Method | Path                  | Notes |
| ------ | --------------------- | ----- |
| GET    | `/cart`               | `CartView` (items, coupon, totals, warnings) |
| POST   | `/cart/items`         | `{ variantId, quantity }` — accumulates, capped by stock and 10 per line |
| PATCH  | `/cart/items/:itemId` | `{ quantity }` (0 removes) |
| DELETE | `/cart/items/:itemId` | remove line |
| DELETE | `/cart`               | empty cart |
| POST   | `/cart/coupon`        | `{ code }` — validated (active, dates, limits, minimum) |
| DELETE | `/cart/coupon`        | remove coupon |

## Checkout (user)

| Method | Path                         | Notes |
| ------ | ---------------------------- | ----- |
| GET    | `/checkout/shipping-methods` | active methods with the fee for the current cart (free-shipping thresholds applied) |
| POST   | `/checkout/validate`         | `{ addressId, shippingMethodCode }` → `CheckoutQuote` with authoritative totals (`subtotal`, `discount`, `shippingFee`, `grandTotal`), `issues`, `canPlaceOrder` |

## Coupons & shipping (admin)

| Method | Path | Permission |
| ------ | ---- | ---------- |
| GET/POST | `/admin/coupons` | `discounts.manage` |
| GET/PATCH/DELETE | `/admin/coupons/:id` | `discounts.manage` |
| GET | `/admin/shipping-methods` | `orders.view` |
| POST/PATCH/DELETE | `/admin/shipping-methods[/:id]` | `settings.manage` |
