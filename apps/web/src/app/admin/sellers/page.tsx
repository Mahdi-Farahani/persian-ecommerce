import {
  SELLER_STATUS_LABELS,
  SellerStatuses,
  formatJalaliDate,
  formatPersianNumber,
  hasPermission,
  toPersianDigits,
  toToman,
} from '@pe/shared';
import Link from 'next/link';
import { DataTable, Td } from '@/components/admin/data-table';
import { Forbidden } from '@/components/admin/forbidden';
import { PageHeader } from '@/components/admin/page-header';
import { SellerStatusBadge } from '@/components/admin/sellers/status-badges';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/form-field';
import { Pagination } from '@/components/ui/pagination';
import { adminFa } from '@/i18n/admin-fa';
import { AdminPermissions } from '@/lib/admin/navigation';
import { formatCommissionPercent } from '@/lib/admin/sellers';
import { adminListSellers, pageHref, parsePage } from '@/lib/admin/server';
import { requireUser } from '@/lib/auth/server';

export const metadata = { title: adminFa.sellers.title };

const copy = adminFa.sellers;
const PAGE_SIZE = 20;

const columns = [
  { key: 'store', label: copy.table.store },
  { key: 'owner', label: copy.table.owner },
  { key: 'status', label: copy.table.status },
  { key: 'commission', label: copy.table.commission },
  { key: 'offers', label: copy.table.offers },
  { key: 'pendingSettlement', label: copy.table.pendingSettlement },
  { key: 'appliedAt', label: copy.table.appliedAt },
] as const;

const statusOptions = SellerStatuses.map((status) => ({
  value: status,
  label: SELLER_STATUS_LABELS[status],
}));

export default async function AdminSellersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}) {
  const user = await requireUser('/admin/sellers');
  if (!hasPermission(user, AdminPermissions.sellersView)) return <Forbidden />;

  const params = await searchParams;
  const page = parsePage(params.page);
  const search = params.search?.trim() ?? '';
  const status =
    params.status && (SellerStatuses as readonly string[]).includes(params.status)
      ? params.status
      : '';
  const hasFilters = Boolean(search || status);

  const result = await adminListSellers({ page, limit: PAGE_SIZE, search, status });

  return (
    <div>
      <PageHeader
        title={copy.title}
        description={`${copy.description} ${adminFa.common.total(formatPersianNumber(result.pagination.total))}`}
      />
      <form method="get" action="/admin/sellers" className="mb-4 flex flex-wrap items-end gap-3">
        <TextField
          label={adminFa.common.search}
          name="search"
          defaultValue={search}
          placeholder={copy.searchPlaceholder}
          containerClassName="min-w-56 flex-1"
        />
        <SelectField
          label={adminFa.common.status}
          name="status"
          defaultValue={status}
          placeholder={copy.allStatuses}
          options={statusOptions}
        />
        <Button type="submit" variant="secondary">
          {adminFa.common.filter}
        </Button>
        {hasFilters ? (
          <Link
            href="/admin/sellers"
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
        {result.items.map((seller) => (
          <tr key={seller.id} className="hover:bg-surface-muted/60">
            <Td>
              <Link
                href={`/admin/sellers/${seller.id}`}
                className="font-medium hover:text-brand-700"
              >
                {seller.storeName}
              </Link>
              <span className="block text-xs text-ink-muted" dir="ltr">
                {seller.slug}
              </span>
            </Td>
            <Td>
              <div className="flex flex-col">
                <span>{seller.user.name || adminFa.users.noName}</span>
                <span className="text-xs text-ink-muted" dir="ltr">
                  {seller.user.email ??
                    (seller.user.phone ? toPersianDigits(seller.user.phone) : '')}
                </span>
              </div>
            </Td>
            <Td>
              <SellerStatusBadge status={seller.status} />
            </Td>
            <Td className="tabular-nums">{formatCommissionPercent(seller.commissionBps)}</Td>
            <Td className="tabular-nums">{formatPersianNumber(seller.offerCount)}</Td>
            <Td className="tabular-nums">
              {formatPersianNumber(toToman(seller.pendingSettlementAmount))}
            </Td>
            <Td className="text-xs whitespace-nowrap text-ink-muted">
              {formatJalaliDate(seller.createdAt)}
            </Td>
          </tr>
        ))}
      </DataTable>
      <div className="mt-4">
        <Pagination
          pagination={result.pagination}
          hrefFor={pageHref('/admin/sellers', { search, status })}
        />
      </div>
    </div>
  );
}
