/**
 * Catalogue of granular permissions. Roles are bundles of permissions; guards
 * check permissions (never `role === ADMIN`) for sensitive operations.
 *
 * Keys follow `<resource>.<action>`. Keep this list in sync with the seed.
 */
export const Permissions = {
  // users & rbac
  UsersView: 'users.view',
  UsersManage: 'users.manage',
  RolesManage: 'roles.manage',
  // catalog
  CatalogView: 'catalog.view',
  CatalogManage: 'catalog.manage',
  // inventory
  InventoryView: 'inventory.view',
  InventoryManage: 'inventory.manage',
  // orders
  OrdersView: 'orders.view',
  OrdersManage: 'orders.manage',
  // discounts / coupons
  DiscountsManage: 'discounts.manage',
  // reviews
  ReviewsModerate: 'reviews.moderate',
  // sellers
  SellersView: 'sellers.view',
  SellersManage: 'sellers.manage',
  SellerPortal: 'seller.portal',
  // payments
  PaymentGatewayView: 'payment_gateway.view',
  PaymentGatewayUpdate: 'payment_gateway.update',
  PaymentGatewayTest: 'payment_gateway.test',
  PaymentView: 'payment.view',
  PaymentRefund: 'payment.refund',
  PaymentReconcile: 'payment.reconcile',
  // content / settings
  ContentManage: 'content.manage',
  SettingsManage: 'settings.manage',
  // reporting & audit
  ReportsView: 'reports.view',
  AuditLogsView: 'audit_logs.view',
} as const;

export type PermissionKey = (typeof Permissions)[keyof typeof Permissions];

export const ALL_PERMISSIONS: readonly PermissionKey[] = Object.values(Permissions);

export const PERMISSION_DESCRIPTIONS: Record<
  PermissionKey,
  { group: string; description: string }
> = {
  'users.view': { group: 'users', description: 'مشاهده کاربران' },
  'users.manage': { group: 'users', description: 'مدیریت کاربران' },
  'roles.manage': { group: 'users', description: 'مدیریت نقش‌ها و دسترسی‌ها' },
  'catalog.view': { group: 'catalog', description: 'مشاهده کاتالوگ در پنل مدیریت' },
  'catalog.manage': { group: 'catalog', description: 'مدیریت محصولات، دسته‌بندی‌ها و برندها' },
  'inventory.view': { group: 'inventory', description: 'مشاهده موجودی' },
  'inventory.manage': { group: 'inventory', description: 'مدیریت موجودی' },
  'orders.view': { group: 'orders', description: 'مشاهده سفارش‌ها' },
  'orders.manage': { group: 'orders', description: 'مدیریت سفارش‌ها' },
  'discounts.manage': { group: 'discounts', description: 'مدیریت تخفیف‌ها و کدهای تخفیف' },
  'reviews.moderate': { group: 'reviews', description: 'بررسی و تأیید نظرات' },
  'sellers.view': { group: 'sellers', description: 'مشاهده فروشندگان' },
  'sellers.manage': { group: 'sellers', description: 'مدیریت فروشندگان' },
  'seller.portal': { group: 'sellers', description: 'دسترسی به پنل فروشنده' },
  'payment_gateway.view': { group: 'payments', description: 'مشاهده تنظیمات درگاه پرداخت' },
  'payment_gateway.update': { group: 'payments', description: 'ویرایش تنظیمات درگاه پرداخت' },
  'payment_gateway.test': { group: 'payments', description: 'تست اتصال درگاه پرداخت' },
  'payment.view': { group: 'payments', description: 'مشاهده پرداخت‌ها' },
  'payment.refund': { group: 'payments', description: 'بازگشت وجه' },
  'payment.reconcile': { group: 'payments', description: 'مغایرت‌گیری پرداخت' },
  'content.manage': { group: 'content', description: 'مدیریت محتوا و بنرها' },
  'settings.manage': { group: 'settings', description: 'مدیریت تنظیمات سیستم' },
  'reports.view': { group: 'reports', description: 'مشاهده گزارش‌ها' },
  'audit_logs.view': { group: 'reports', description: 'مشاهده لاگ‌های ممیزی' },
};

export const RoleName = {
  Customer: 'CUSTOMER',
  Seller: 'SELLER',
  Admin: 'ADMIN',
  SuperAdmin: 'SUPER_ADMIN',
} as const;
export type RoleNameValue = (typeof RoleName)[keyof typeof RoleName];

/** Default permission bundles for system roles. */
export const ROLE_PERMISSIONS: Record<RoleNameValue, readonly PermissionKey[]> = {
  CUSTOMER: [],
  SELLER: [Permissions.SellerPortal],
  ADMIN: [
    Permissions.UsersView,
    Permissions.UsersManage,
    Permissions.CatalogView,
    Permissions.CatalogManage,
    Permissions.InventoryView,
    Permissions.InventoryManage,
    Permissions.OrdersView,
    Permissions.OrdersManage,
    Permissions.DiscountsManage,
    Permissions.ReviewsModerate,
    Permissions.SellersView,
    Permissions.SellersManage,
    Permissions.PaymentGatewayView,
    Permissions.PaymentView,
    Permissions.PaymentReconcile,
    Permissions.ContentManage,
    Permissions.ReportsView,
    Permissions.AuditLogsView,
  ],
  SUPER_ADMIN: ALL_PERMISSIONS,
};
