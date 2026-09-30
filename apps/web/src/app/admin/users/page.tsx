import { RoleNames, UserStatuses, formatPersianNumber, hasPermission } from '@pe/shared';
import Link from 'next/link';
import { PageHeader } from '@/components/admin/page-header';
import { UsersTable } from '@/components/admin/users/users-table';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/form-field';
import { Pagination } from '@/components/ui/pagination';
import { adminFa } from '@/i18n/admin-fa';
import { AdminPermissions } from '@/lib/admin/navigation';
import { adminListUsers, pageHref, parsePage } from '@/lib/admin/server';
import { requireUser } from '@/lib/auth/server';

export const metadata = { title: adminFa.users.title };

const PAGE_SIZE = 20;

const statusOptions = UserStatuses.map((status) => ({
  value: status,
  label: adminFa.users.status[status] ?? status,
}));
const roleOptions = RoleNames.map((role) => ({
  value: role,
  label: adminFa.users.roles[role] ?? role,
}));

function pick(value: string | undefined, allowed: readonly string[]): string {
  return value && allowed.includes(value) ? value : '';
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string; role?: string }>;
}) {
  const user = await requireUser('/admin/users');
  const params = await searchParams;
  const page = parsePage(params.page);
  const search = params.search?.trim() ?? '';
  const status = pick(params.status, UserStatuses);
  const role = pick(params.role, RoleNames);

  const result = await adminListUsers({ page, limit: PAGE_SIZE, search, status, role });
  const hasFilters = Boolean(search || status || role);

  return (
    <div>
      <PageHeader
        title={adminFa.users.title}
        description={adminFa.common.total(formatPersianNumber(result.pagination.total))}
      />
      <form method="get" action="/admin/users" className="mb-4 flex flex-wrap items-end gap-3">
        <TextField
          label={adminFa.common.search}
          name="search"
          defaultValue={search}
          placeholder={adminFa.users.searchPlaceholder}
          containerClassName="min-w-56 flex-1"
        />
        <SelectField
          label={adminFa.common.status}
          name="status"
          defaultValue={status}
          placeholder={adminFa.users.allStatuses}
          options={statusOptions}
        />
        <SelectField
          label={adminFa.users.role}
          name="role"
          defaultValue={role}
          placeholder={adminFa.users.allRoles}
          options={roleOptions}
        />
        <Button type="submit" variant="secondary">
          {adminFa.common.filter}
        </Button>
        {hasFilters ? (
          <Link
            href="/admin/users"
            className="inline-flex h-11 items-center px-2 text-sm text-ink-muted hover:text-brand-700"
          >
            {adminFa.common.clearFilters}
          </Link>
        ) : null}
      </form>
      <UsersTable
        users={result.items}
        canManage={hasPermission(user, AdminPermissions.usersManage)}
      />
      <div className="mt-4">
        <Pagination
          pagination={result.pagination}
          hrefFor={pageHref('/admin/users', { search, status, role })}
        />
      </div>
    </div>
  );
}
