import { formatPersianNumber, hasPermission } from '@pe/shared';
import Link from 'next/link';
import { AuditLogRow } from '@/components/admin/audit-logs/audit-log-row';
import { DataTable } from '@/components/admin/data-table';
import { Forbidden } from '@/components/admin/forbidden';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/form-field';
import { Pagination } from '@/components/ui/pagination';
import { adminFa } from '@/i18n/admin-fa';
import { AdminPermissions } from '@/lib/admin/navigation';
import {
  adminAuditLogActions,
  adminListAuditLogs,
  optional,
  pageHref,
  parsePage,
} from '@/lib/admin/server';
import { requireUser } from '@/lib/auth/server';

export const metadata = { title: adminFa.auditLogs.title };

const copy = adminFa.auditLogs;
const PAGE_SIZE = 25;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Mirrors the API's accepted action filter characters. */
const ACTION_PATTERN = /^[a-z0-9_.-]{1,100}$/i;
const ENTITY_TYPE_MAX = 100;
const ENTITY_ID_MAX = 64;

const columns = [
  { key: 'time', label: copy.table.time },
  { key: 'actor', label: copy.table.actor },
  { key: 'action', label: copy.table.action },
  { key: 'entity', label: copy.table.entity },
  { key: 'ip', label: copy.table.ip },
  { key: 'details', label: copy.table.details, srOnly: true, className: 'w-px' },
] as const;

function isoDate(value: string | undefined): string {
  return value && ISO_DATE.test(value) ? value : '';
}

function bounded(value: string | undefined, max: number): string {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : '';
}

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const user = await requireUser('/admin/audit-logs');
  if (!hasPermission(user, AdminPermissions.auditLogsView)) return <Forbidden />;

  const params = await searchParams;
  const page = parsePage(params.page);
  const action = params.action && ACTION_PATTERN.test(params.action) ? params.action : '';
  const entityType = bounded(params.entityType, ENTITY_TYPE_MAX);
  const entityId = bounded(params.entityId, ENTITY_ID_MAX);
  const from = isoDate(params.from);
  const to = isoDate(params.to);
  const hasFilters = Boolean(action || entityType || entityId || from || to);

  const [result, actions] = await Promise.all([
    adminListAuditLogs({
      page,
      limit: PAGE_SIZE,
      action,
      entityType,
      entityId,
      from,
      // Inclusive end of the selected day.
      to: to ? `${to}T23:59:59.999` : '',
    }),
    optional(adminAuditLogActions()),
  ]);
  const actionOptions = (actions ?? []).map((name) => ({ value: name, label: name }));
  if (action && !actionOptions.some((option) => option.value === action)) {
    actionOptions.unshift({ value: action, label: action });
  }

  return (
    <div>
      <PageHeader
        title={copy.title}
        description={`${copy.description} ${adminFa.common.total(formatPersianNumber(result.pagination.total))}`}
      />
      <form method="get" action="/admin/audit-logs" className="mb-4 flex flex-wrap items-end gap-3">
        <SelectField
          label={copy.filters.action}
          name="action"
          defaultValue={action}
          placeholder={copy.filters.allActions}
          options={actionOptions}
          dir="ltr"
        />
        <TextField
          label={copy.filters.entityType}
          name="entityType"
          defaultValue={entityType}
          placeholder={copy.filters.entityTypePlaceholder}
          maxLength={ENTITY_TYPE_MAX}
          dir="ltr"
          className="text-left"
        />
        <TextField
          label={copy.filters.entityId}
          name="entityId"
          defaultValue={entityId}
          maxLength={ENTITY_ID_MAX}
          dir="ltr"
          className="text-left font-mono"
          containerClassName="min-w-64"
        />
        <TextField
          label={copy.filters.from}
          name="from"
          type="date"
          defaultValue={from}
          dir="ltr"
        />
        <TextField label={copy.filters.to} name="to" type="date" defaultValue={to} dir="ltr" />
        <Button type="submit" variant="secondary">
          {adminFa.common.filter}
        </Button>
        {hasFilters ? (
          <Link
            href="/admin/audit-logs"
            className="inline-flex h-11 items-center px-2 text-sm text-ink-muted hover:text-brand-700"
          >
            {adminFa.common.clearFilters}
          </Link>
        ) : null}
      </form>
      <DataTable
        columns={columns}
        empty={result.items.length === 0}
        emptyMessage={copy.empty}
        caption={copy.title}
      >
        {result.items.map((entry) => (
          <AuditLogRow key={entry.id} entry={entry} />
        ))}
      </DataTable>
      <div className="mt-4">
        <Pagination
          pagination={result.pagination}
          hrefFor={pageHref('/admin/audit-logs', { action, entityType, entityId, from, to })}
        />
      </div>
    </div>
  );
}
