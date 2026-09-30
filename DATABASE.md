# Database Design

## Database

MariaDB.

ORM:

```text
Prisma
```

---

# 1. Core Entities

The database should contain entities conceptually covering:

```text
User
Role
Permission
UserRole
RolePermission

Address

Brand
Category
CategoryHierarchy

Product
ProductImage
ProductAttribute
Attribute
AttributeValue

ProductVariant
VariantAttribute

Seller
SellerProduct

Inventory
InventoryTransaction

Cart
CartItem

Wishlist
WishlistItem

Order
OrderItem
OrderStatusHistory

Payment
PaymentTransaction

ShippingMethod
Shipment
ShipmentTracking

Coupon
Discount

Review

Notification

AuditLog
```

Exact naming may be adapted to Prisma conventions.

---

# 2. User

User should support:

* id
* email
* phone
* password hash
* first name
* last name
* status
* timestamps

Unique constraints must exist where appropriate.

---

# 3. Roles

Support:

```text
CUSTOMER
SELLER
ADMIN
SUPER_ADMIN
```

Use relational RBAC.

---

# 4. Category

Categories are hierarchical.

Support:

* parent
* children
* slug
* name
* description
* image
* SEO metadata
* sort order
* active status

Use indexes for:

* slug
* parent
* active status

---

# 5. Product

Product should not contain every variant-specific value.

Separate:

```text
Product
ProductVariant
```

Example:

```text
Product:
iPhone 17

Variants:
256GB Black
256GB White
512GB Black
```

---

# 6. Product Variant

Variant must support:

* SKU
* barcode
* price
* compare-at price
* inventory relation
* attributes
* status

SKU must be unique.

---

# 7. Inventory

Inventory must track:

```text
stockQuantity
reservedQuantity
```

Available quantity:

```text
stockQuantity - reservedQuantity
```

Inventory transactions must be immutable where possible.

Examples:

```text
PURCHASE
RESERVATION
RELEASE
SALE
RETURN
ADJUSTMENT
```

---

# 8. Cart

Cart belongs to:

* authenticated user

or:

* guest session identifier

Cart item references product variant.

---

# 9. Order

Orders must snapshot relevant information.

Do not rely on current product information for historical order display.

OrderItem should preserve:

* product title
* SKU
* unit price
* quantity
* discount
* total

---

# 10. Payment

Payment records must include:

* order
* amount
* provider
* provider transaction ID
* status
* timestamps

Never store sensitive card information.

---

# 11. Audit Log

Administrative actions should be auditable.

Include:

* actor
* action
* entity
* entity ID
* metadata
* timestamp

---

# 12. Indexing

Add indexes based on query patterns.

At minimum consider indexes for:

* product slug
* product status
* category slug
* category parent
* SKU
* barcode
* seller
* order status
* user
* createdAt
* inventory status

Do not add indexes blindly.

---

# 13. Data Integrity

Use:

* foreign keys
* unique constraints
* check constraints where supported/appropriate
* transactions
* explicit nullable fields

Do not depend exclusively on application-level validation for data integrity.

---

# 14. Migrations

All schema changes must use Prisma migrations.

Never use destructive migrations without explicit justification.

For production migrations:

1. backup
2. migration
3. verification

---

# 15. Seed Data

Provide development seed data for:

* roles
* permissions
* admin
* categories
* brands
* sample products
* sample variants
* sample inventory

Seed scripts must be deterministic and safe to rerun where possible.

---

# 16. Implementation Notes (as built)

* Primary keys are UUID v7 strings (`CHAR(36)`): time-ordered for index
  locality and unguessable in public URLs.
* Table names are snake_case plural (`@@map`), columns camelCase.
* Monetary columns are `BIGINT` integers in IRR (see ARCHITECTURE.md §21).
* Character set `utf8mb4` / collation `utf8mb4_unicode_ci` for full Persian
  support.
* Migrations live in `apps/api/prisma/migrations` and are applied with
  `prisma migrate deploy` by the API container entrypoint on start.
* Seed: `apps/api/src/database/seed` (roles, permissions, bootstrap admin).
  The admin password comes from `SEED_ADMIN_PASSWORD`; when absent a random
  password is generated and printed once.
* Integration tests use a separate `<database>_test` schema created and
  migrated automatically by the vitest global setup.

## Catalog (as built)

* `categories.path` is a materialised path of ancestor ids (`/id1/id2/`) with
  `depth`; subtree queries use `path LIKE '<path><id>/%'`. Maximum depth 6.
* Attributes are either informational (`product_attribute_values`) or
  variant-defining (`attributes.isVariant`, `variant_attribute_values`).
  `category_attributes` links attributes to categories; a category inherits
  the attributes of its ancestors for filtering.
* `products.minPrice` / `maxPrice` are denormalised from active variants and
  recalculated on every variant change (used for price filters and sorting).
* `inventory` has one row per variant (`stock`, `reserved`, threshold);
  `inventory_transactions` is an append-only ledger (`stockAfter`,
  `reservedAfter` snapshots). Stock mutations lock the row with
  `SELECT … FOR UPDATE`.
* Images are stored by the storage provider (local disk under `UPLOADS_DIR`,
  served at `/uploads/*`); the database keeps only the URL.

## Cart & checkout (as built)

* `carts` belong to a user (`userId`) or to a guest session (`sessionHash`,
  SHA-256 of the cookie token). Status `ACTIVE → MERGED | CONVERTED | ABANDONED`.
* `cart_items` are unique per `(cartId, variantId)` and remember `priceAtAdd`
  so price changes can be surfaced.
* `coupons`: `PERCENTAGE` (0-100) or `FIXED` (IRR) with optional cap, minimum
  cart amount, validity window and usage limits.
* `shipping_methods`: flat `baseFee` with optional `freeAboveAmount`.

## Orders & payments (as built)

* `orders`: sequential `number` (rendered `PE-000042`), `status` enum
  (`PENDING_PAYMENT → PAID → PROCESSING → PACKED → SHIPPED → DELIVERED`,
  plus `CANCELLED`, `RETURN_REQUESTED`, `RETURNED`, `REFUNDED`; transitions
  in `orders/order-status.ts`), integer IRR money (`subtotal`, `discount`,
  `shippingFee`, `total`), snapshots of the address and shipping method,
  `paymentDeadlineAt` (unpaid orders are cancelled after it). Indexes on
  `(userId, createdAt)`, `(status, createdAt)`, `(status, paymentDeadlineAt)`.
* `order_items`: immutable line snapshots (`variantId` nullable with
  `SET NULL` so deleting a variant keeps history).
* `order_status_history`: append-only audit trail of transitions.
* `shipments` / `shipment_tracking`: carrier, tracking code, events.
* `payments`: one row per attempt, unique `(orderId, attemptNumber)` and
  unique `requestId` (idempotency key); `provider`, `environment`, `status`
  (`INITIATED, REDIRECTED, CALLBACK_RECEIVED, VERIFYING, PAID, FAILED,
  CANCELLED, EXPIRED, REFUNDED`), `providerAuthority`,
  `providerTransactionId`, masked PAN, error code/message, redacted
  callback/verification JSON, timestamps. Index `(provider, providerAuthority)`
  serves callback lookup.
* `payment_transactions`: immutable ledger of provider interactions
  (`PAYMENT, REFUND, REVERSE, SETTLEMENT, INQUIRY`) with success flag,
  provider reference and redacted payload.
* `payment_provider_configs`: registry row per provider — `enabled`,
  `isDefault` (one at most, enforced in code), `environment`,
  `credentialsEncrypted` (AES-256-GCM), `configuration` JSON, last test result.
* Inventory: placing an order reserves stock (`reservedQuantity`) inside the
  same transaction; payment success commits the sale, cancellation/expiry
  releases it, returns restock — all through the `inventory_transactions`
  ledger.

## Transaction isolation (as built)

MariaDB 11 ships with `innodb_snapshot_isolation=ON`. Under the default
REPEATABLE READ level a `SELECT … FOR UPDATE` issued after any earlier read in
the same transaction fails with error 1020 ("Record has changed since last
read") when another session changed the row in between — exactly what happens
when two checkouts compete for the same stock. The Prisma adapter therefore
starts every pooled session with
`SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED`
(`apps/api/src/prisma/prisma.service.ts`). Correctness of stock, order and
payment updates does not depend on snapshot reads: every write path locks the
rows it changes (`InventoryService.lock`, payment claim updates) inside one
transaction. `test/inventory.integration-spec.ts` covers four concurrent
checkouts contending for three units.

## Reviews & wishlist (as built)

* `reviews`: one row per `(productId, userId)` (unique), `rating` 1–5,
  `title`, `body`, `status` (`PENDING → APPROVED | REJECTED`),
  `isVerifiedPurchase` (author had a paid order containing the product when
  submitting), moderation note/actor/time. Indexes on
  `(productId, status, createdAt)`, `(status, createdAt)`, `(userId, createdAt)`.
  `products.ratingAverage` / `ratingCount` are recomputed from `APPROVED`
  rows on every status change, edit and delete.
* `wishlist_items`: composite key `(userId, productId)`, cascade on user and
  product deletion, capped at 200 per user in the service.
