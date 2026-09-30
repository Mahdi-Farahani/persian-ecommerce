import { formatPersianNumber, hasPermission } from '@pe/shared';
import Link from 'next/link';
import { BrandManager } from '@/components/admin/brands/brand-manager';
import { Checkbox } from '@/components/admin/checkbox';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/form-field';
import { Pagination } from '@/components/ui/pagination';
import { adminFa } from '@/i18n/admin-fa';
import { AdminPermissions } from '@/lib/admin/navigation';
import { adminListBrands, pageHref, parsePage } from '@/lib/admin/server';
import { requireUser } from '@/lib/auth/server';

export const metadata = { title: adminFa.brands.title };

const PAGE_SIZE = 20;

export default async function AdminBrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; includeInactive?: string }>;
}) {
  const user = await requireUser('/admin/brands');
  const params = await searchParams;
  const page = parsePage(params.page);
  const search = params.search?.trim() ?? '';
  const includeInactive = params.includeInactive === '1';

  const result = await adminListBrands({
    page,
    limit: PAGE_SIZE,
    search,
    includeInactive: includeInactive ? 'true' : undefined,
  });

  return (
    <div>
      <PageHeader
        title={adminFa.brands.title}
        description={adminFa.common.total(formatPersianNumber(result.pagination.total))}
      />
      <form method="get" action="/admin/brands" className="mb-4 flex flex-wrap items-end gap-3">
        <TextField
          label={adminFa.common.search}
          name="search"
          defaultValue={search}
          placeholder={adminFa.brands.searchPlaceholder}
          containerClassName="min-w-56 flex-1"
        />
        <Checkbox
          label={adminFa.brands.includeInactive}
          name="includeInactive"
          value="1"
          defaultChecked={includeInactive}
          containerClassName="h-11"
        />
        <Button type="submit" variant="secondary">
          {adminFa.common.filter}
        </Button>
        {search || includeInactive ? (
          <Link
            href="/admin/brands"
            className="inline-flex h-11 items-center px-2 text-sm text-ink-muted hover:text-brand-700"
          >
            {adminFa.common.clearFilters}
          </Link>
        ) : null}
      </form>
      <BrandManager
        brands={result.items}
        canManage={hasPermission(user, AdminPermissions.catalogManage)}
      />
      <div className="mt-4">
        <Pagination
          pagination={result.pagination}
          hrefFor={pageHref('/admin/brands', {
            search,
            includeInactive: includeInactive ? '1' : undefined,
          })}
        />
      </div>
    </div>
  );
}
