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
