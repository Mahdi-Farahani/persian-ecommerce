import { displayName, formatPersianNumber, hasPermission } from '@pe/shared';
import Link from 'next/link';
import { PageHeader } from '@/components/admin/page-header';
import { Card, CardTitle } from '@/components/ui/card';
import { adminFa } from '@/i18n/admin-fa';
import { AdminPermissions } from '@/lib/admin/navigation';
import {
  adminListBrands,
  adminListCategories,
  adminListProducts,
  adminListUsers,
  optional,
} from '@/lib/admin/server';
import { requireUser } from '@/lib/auth/server';

export const metadata = { title: adminFa.dashboard.title };

interface Stat {
  label: string;
  value: number | null;
  href: string;
}

export default async function AdminDashboardPage() {
  const user = await requireUser('/admin');
  const canCatalog = hasPermission(user, AdminPermissions.catalogView);
  const canManageCatalog = hasPermission(user, AdminPermissions.catalogManage);
  const canUsers = hasPermission(user, AdminPermissions.usersView);

  const [products, categories, brands, users] = await Promise.all([
    canCatalog ? optional(adminListProducts({ limit: 1 })) : null,
    canCatalog ? optional(adminListCategories()) : null,
    canCatalog ? optional(adminListBrands({ limit: 1, includeInactive: 'true' })) : null,
    canUsers ? optional(adminListUsers({ limit: 1 })) : null,
  ]);

  const stats: Stat[] = [
    {
      label: adminFa.dashboard.products,
      value: products?.pagination.total ?? null,
      href: '/admin/products',
    },
    {
      label: adminFa.dashboard.categories,
      value: categories?.length ?? null,
      href: '/admin/categories',
    },
    {
      label: adminFa.dashboard.brands,
      value: brands?.pagination.total ?? null,
      href: '/admin/brands',
    },
    {
      label: adminFa.dashboard.users,
      value: users?.pagination.total ?? null,
      href: '/admin/users',
    },
  ];

  const quickLinks: Array<{ href: string; label: string; show: boolean }> = [
    { href: '/admin/products/new', label: adminFa.dashboard.newProduct, show: canManageCatalog },
    { href: '/admin/products', label: adminFa.dashboard.manageProducts, show: canCatalog },
    { href: '/admin/categories', label: adminFa.dashboard.manageCategories, show: canCatalog },
    { href: '/admin/brands', label: adminFa.dashboard.manageBrands, show: canCatalog },
    { href: '/admin/attributes', label: adminFa.dashboard.manageAttributes, show: canCatalog },
    { href: '/admin/users', label: adminFa.dashboard.manageUsers, show: canUsers },
  ];

  return (
    <div>
      <PageHeader
        title={adminFa.dashboard.title}
        description={adminFa.dashboard.welcome(displayName(user))}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.href} href={stat.href} className="block">
            <Card className="h-full transition hover:border-brand-400">
              <p className="text-sm text-ink-muted">{stat.label}</p>
              <p className="mt-2 text-3xl font-bold tabular-nums">
                {stat.value === null ? (
                  <span className="text-base font-normal text-ink-muted">
                    {adminFa.dashboard.unavailable}
                  </span>
                ) : (
                  formatPersianNumber(stat.value)
                )}
              </p>
            </Card>
          </Link>
        ))}
      </div>
      <Card className="mt-6">
        <CardTitle>{adminFa.dashboard.quickLinks}</CardTitle>
        <ul className="flex flex-wrap gap-2">
          {quickLinks
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
    </div>
  );
}
