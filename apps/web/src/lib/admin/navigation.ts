import { hasPermission, type AuthUser } from '@pe/shared';
import { adminFa } from '@/i18n/admin-fa';

export const AdminPermissions = {
  catalogView: 'catalog.view',
  catalogManage: 'catalog.manage',
  inventoryView: 'inventory.view',
  inventoryManage: 'inventory.manage',
  usersView: 'users.view',
  usersManage: 'users.manage',
  ordersView: 'orders.view',
  ordersManage: 'orders.manage',
  paymentView: 'payment.view',
  paymentReconcile: 'payment.reconcile',
  paymentRefund: 'payment.refund',
  paymentGatewayView: 'payment_gateway.view',
  paymentGatewayUpdate: 'payment_gateway.update',
  paymentGatewayTest: 'payment_gateway.test',
  reviewsModerate: 'reviews.moderate',
} as const;

/** Permissions that grant access to the admin shell at all. */
const ENTRY_PERMISSIONS = [
  AdminPermissions.catalogView,
  AdminPermissions.usersView,
  AdminPermissions.inventoryView,
  AdminPermissions.ordersView,
  AdminPermissions.paymentView,
  AdminPermissions.paymentGatewayView,
  AdminPermissions.reviewsModerate,
] as const;

export interface AdminNavItem {
  href: string;
  label: string;
  /** Any of these permissions unlocks the item. */
  permissions: readonly string[];
}

export const adminNavItems: readonly AdminNavItem[] = [
  { href: '/admin', label: adminFa.nav.dashboard, permissions: ENTRY_PERMISSIONS },
  {
    href: '/admin/products',
    label: adminFa.nav.products,
    permissions: [AdminPermissions.catalogView],
  },
  {
    href: '/admin/categories',
    label: adminFa.nav.categories,
    permissions: [AdminPermissions.catalogView],
  },
  { href: '/admin/brands', label: adminFa.nav.brands, permissions: [AdminPermissions.catalogView] },
  {
    href: '/admin/attributes',
    label: adminFa.nav.attributes,
    permissions: [AdminPermissions.catalogView],
  },
  {
    href: '/admin/inventory',
    label: adminFa.nav.inventory,
    permissions: [AdminPermissions.inventoryView],
  },
  { href: '/admin/orders', label: adminFa.nav.orders, permissions: [AdminPermissions.ordersView] },
  {
    href: '/admin/payments',
    label: adminFa.nav.payments,
    permissions: [AdminPermissions.paymentView],
  },
  {
    href: '/admin/settings/payment-gateways',
    label: adminFa.nav.paymentGateways,
    permissions: [AdminPermissions.paymentGatewayView],
  },
  {
    href: '/admin/reviews',
    label: adminFa.nav.reviews,
    permissions: [AdminPermissions.reviewsModerate],
  },
  { href: '/admin/users', label: adminFa.nav.users, permissions: [AdminPermissions.usersView] },
];

type Principal = Pick<AuthUser, 'permissions' | 'roles'> | null | undefined;

export function hasAnyPermission(user: Principal, permissions: readonly string[]): boolean {
  return permissions.some((permission) => hasPermission(user, permission));
}

export function canAccessAdmin(user: Principal): boolean {
  return hasAnyPermission(user, ENTRY_PERMISSIONS);
}

export function visibleNavItems(user: Principal): AdminNavItem[] {
  return adminNavItems.filter((item) => hasAnyPermission(user, item.permissions));
}
