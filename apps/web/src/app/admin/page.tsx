import { displayName, formatJalaliDateTime, hasPermission, type AuthUser } from '@pe/shared';
import Link from 'next/link';
import { KpiCards } from '@/components/admin/dashboard/kpi-cards';
import { RecentActivity } from '@/components/admin/dashboard/recent-activity';
import { RecentOrders } from '@/components/admin/dashboard/recent-orders';
import { SalesChart } from '@/components/admin/dashboard/sales-chart';
import { StatList, type StatRow } from '@/components/admin/dashboard/stat-list';
import { Forbidden } from '@/components/admin/forbidden';
import { PageHeader } from '@/components/admin/page-header';
import { Alert } from '@/components/ui/alert';
import { Card, CardTitle } from '@/components/ui/card';
import { adminFa } from '@/i18n/admin-fa';
import { AdminPermissions } from '@/lib/admin/navigation';
import { adminDashboard, optional } from '@/lib/admin/server';
import { requireUser } from '@/lib/auth/server';

export const metadata = { title: adminFa.dashboard.title };

const copy = adminFa.dashboard;

function QuickLinks({ user }: { user: AuthUser }) {
  const can = (permission: string) => hasPermission(user, permission);
  const links: Array<{ href: string; label: string; show: boolean }> = [
    {
      href: '/admin/products/new',
      label: copy.newProduct,
      show: can(AdminPermissions.catalogManage),
    },
    {
      href: '/admin/products',
      label: copy.manageProducts,
      show: can(AdminPermissions.catalogView),
    },
    {
      href: '/admin/categories',
      label: copy.manageCategories,
      show: can(AdminPermissions.catalogView),
    },
    { href: '/admin/brands', label: copy.manageBrands, show: can(AdminPermissions.catalogView) },
    {
      href: '/admin/attributes',
      label: copy.manageAttributes,
      show: can(AdminPermissions.catalogView),
    },
    {
      href: '/admin/inventory',
      label: copy.manageInventory,
      show: can(AdminPermissions.inventoryView),
    },
    { href: '/admin/users', label: copy.manageUsers, show: can(AdminPermissions.usersView) },
    { href: '/admin/orders', label: copy.manageOrders, show: can(AdminPermissions.ordersView) },
    {
      href: '/admin/payments',
      label: copy.managePayments,
      show: can(AdminPermissions.paymentView),
    },
    {
      href: '/admin/settings/payment-gateways',
      label: copy.managePaymentGateways,
      show: can(AdminPermissions.paymentGatewayView),
    },
    {
      href: '/admin/coupons',
      label: copy.manageCoupons,
      show: can(AdminPermissions.discountsManage),
    },
    {
      href: '/admin/shipping-methods',
      label: copy.manageShippingMethods,
      show: can(AdminPermissions.settingsManage) || can(AdminPermissions.ordersView),
    },
    {
      href: '/admin/reviews?status=PENDING',
      label: copy.manageReviews,
      show: can(AdminPermissions.reviewsModerate),
    },
    {
      href: '/admin/audit-logs',
      label: copy.viewAuditLogs,
      show: can(AdminPermissions.auditLogsView),
    },
  ];
  return (
    <Card>
      <CardTitle>{copy.quickLinks}</CardTitle>
      <ul className="flex flex-wrap gap-2">
        {links
          .filter((link) => link.show)
          .map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium transition hover:border-brand-400 hover:text-brand-700"
              >
                {link.label}
              </Link>
            </li>
          ))}
      </ul>
    </Card>
  );
}

export default async function AdminDashboardPage() {
  const user = await requireUser('/admin');
  const canReports = hasPermission(user, AdminPermissions.reportsView);
  const metrics = canReports ? await optional(adminDashboard()) : null;

  if (!canReports || !metrics) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={copy.title} description={copy.welcome(displayName(user))} />
        {!canReports ? <Forbidden /> : <Alert tone="warning">{copy.unavailable}</Alert>}
        <QuickLinks user={user} />
      </div>
    );
  }

  const linkIf = (permission: string, href: string) =>
    hasPermission(user, permission) ? href : undefined;
  const ordersHref = (status: string) =>
    linkIf(AdminPermissions.ordersView, `/admin/orders?status=${status}`);
  const paymentsHref = (status: string) =>
    linkIf(AdminPermissions.paymentView, `/admin/payments?status=${status}`);
  const catalogHref = (path: string) => linkIf(AdminPermissions.catalogView, path);

  const pipeline: StatRow[] = [
    {
      label: copy.pipeline.pendingPayment,
      value: metrics.orders.pendingPayment,
      href: ordersHref('PENDING_PAYMENT'),
    },
    {
      label: copy.pipeline.paid,
      value: metrics.orders.paid,
      href: ordersHref('PAID'),
      alert: true,
    },
    {
      label: copy.pipeline.processing,
      value: metrics.orders.processing,
      href: ordersHref('PROCESSING'),
    },
    { label: copy.pipeline.packed, value: metrics.orders.packed, href: ordersHref('PACKED') },
    { label: copy.pipeline.shipped, value: metrics.orders.shipped, href: ordersHref('SHIPPED') },
    {
      label: copy.pipeline.deliveredLast30Days,
      value: metrics.orders.deliveredLast30Days,
      href: ordersHref('DELIVERED'),
    },
    {
      label: copy.pipeline.cancelledLast30Days,
      value: metrics.orders.cancelledLast30Days,
      href: ordersHref('CANCELLED'),
    },
    {
      label: copy.pipeline.returnRequested,
      value: metrics.orders.returnRequested,
      href: ordersHref('RETURN_REQUESTED'),
      alert: true,
    },
  ];
  const payments: StatRow[] = [
    {
      label: copy.payments.paidLast7Days,
      value: metrics.payments.paidLast7Days,
      href: paymentsHref('PAID'),
    },
    {
      label: copy.payments.failedLast7Days,
      value: metrics.payments.failedLast7Days,
      href: paymentsHref('FAILED'),
    },
    {
      label: copy.payments.refundedLast30Days,
      value: metrics.payments.refundedLast30Days,
      href: paymentsHref('REFUNDED'),
    },
  ];
  const usersHref = linkIf(AdminPermissions.usersView, '/admin/users');
  const customers: StatRow[] = [
    { label: copy.customers.total, value: metrics.customers.total, href: usersHref },
    { label: copy.customers.newLast7Days, value: metrics.customers.newLast7Days },
    { label: copy.customers.newLast30Days, value: metrics.customers.newLast30Days },
  ];
  const catalog: StatRow[] = [
    {
      label: copy.catalog.activeProducts,
      value: metrics.catalog.activeProducts,
      href: catalogHref('/admin/products?status=ACTIVE'),
    },
    {
      label: copy.catalog.draftProducts,
      value: metrics.catalog.draftProducts,
      href: catalogHref('/admin/products?status=DRAFT'),
    },
    {
      label: copy.catalog.brands,
      value: metrics.catalog.brands,
      href: catalogHref('/admin/brands'),
    },
    {
      label: copy.catalog.categories,
      value: metrics.catalog.categories,
      href: catalogHref('/admin/categories'),
    },
  ];
  const inventoryHref = (query?: string) =>
    linkIf(AdminPermissions.inventoryView, `/admin/inventory${query ? `?${query}` : ''}`);
  const inventory: StatRow[] = [
    {
      label: adminFa.inventory.summary.trackedVariants,
      value: metrics.inventory.trackedVariants,
      href: inventoryHref(),
    },
    {
      label: adminFa.inventory.summary.lowStockVariants,
      value: metrics.inventory.lowStockVariants,
      href: inventoryHref('lowStock=true'),
      alert: true,
    },
    {
      label: adminFa.inventory.summary.outOfStockVariants,
      value: metrics.inventory.outOfStockVariants,
      href: inventoryHref('outOfStock=true'),
      alert: true,
    },
    { label: adminFa.inventory.summary.reservedUnits, value: metrics.inventory.reservedUnits },
    { label: adminFa.inventory.summary.stockUnits, value: metrics.inventory.stockUnits },
  ];
  const reviewsHref = (status: string) =>
    linkIf(AdminPermissions.reviewsModerate, `/admin/reviews?status=${status}`);
  const reviews: StatRow[] = [
    {
      label: copy.reviews.pending,
      value: metrics.reviews.pending,
      href: reviewsHref('PENDING'),
      alert: true,
    },
    {
      label: copy.reviews.approvedLast30Days,
      value: metrics.reviews.approvedLast30Days,
      href: reviewsHref('APPROVED'),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={copy.title}
        description={`${copy.welcome(displayName(user))} · ${copy.generatedAt(formatJalaliDateTime(metrics.generatedAt))}`}
      />
      <KpiCards sales={metrics.sales} />
      <SalesChart points={metrics.dailySales} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatList title={copy.pipeline.title} rows={pipeline} className="md:row-span-2" />
        <StatList title={copy.payments.title} rows={payments} />
        <StatList title={copy.customers.title} rows={customers} />
        <StatList title={copy.catalog.title} rows={catalog} />
        <StatList
          title={copy.inventory.title}
          rows={inventory}
          footer={
            inventoryHref() ? { href: '/admin/inventory', label: copy.inventory.link } : undefined
          }
        />
        <StatList
          title={copy.reviews.title}
          rows={reviews}
          footer={
            reviewsHref('PENDING')
              ? { href: '/admin/reviews?status=PENDING', label: copy.reviews.link }
              : undefined
          }
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <RecentOrders orders={metrics.recentOrders} />
        <RecentActivity
          entries={metrics.recentActivity}
          canViewAll={hasPermission(user, AdminPermissions.auditLogsView)}
        />
      </div>
      <QuickLinks user={user} />
    </div>
  );
}
