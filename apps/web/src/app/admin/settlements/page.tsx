import {
  SETTLEMENT_STATUS_LABELS,
  SettlementStatuses,
  formatJalaliDateTime,
  formatPersianNumber,
  hasPermission,
  toToman,
} from '@pe/shared';
import Link from 'next/link';
import { DataTable, Td } from '@/components/admin/data-table';
import { Forbidden } from '@/components/admin/forbidden';
import { PageHeader } from '@/components/admin/page-header';
import { SettlementStatusBadge } from '@/components/admin/sellers/status-badges';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/form-field';
import { Pagination } from '@/components/ui/pagination';
import { adminFa } from '@/i18n/admin-fa';
import { AdminPermissions } from '@/lib/admin/navigation';
import { pickUuid, settlementPeriod } from '@/lib/admin/sellers';
import { adminGetSeller, adminListSettlements, pageHref, parsePage } from '@/lib/admin/server';
import { requireUser } from '@/lib/auth/server';

export const metadata = { title: adminFa.settlements.title };

const copy = adminFa.settlements;
const PAGE_SIZE = 20;

const columns = [
  { key: 'seller', label: copy.table.seller },
  { key: 'gross', label: copy.table.gross },
  { key: 'commission', label: copy.table.commission },
  { key: 'net', label: copy.table.net },
  { key: 'items', label: copy.table.items },
  { key: 'period', label: copy.table.period },
  { key: 'status', label: copy.table.status },
  { key: 'createdAt', label: copy.table.createdAt },
] as const;

const statusOptions = SettlementStatuses.map((status) => ({
  value: status,
  label: SETTLEMENT_STATUS_LABELS[status],
}));

export default async function AdminSettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; sellerId?: string }>;
}) {
  const user = await requireUser('/admin/settlements');
  if (!hasPermission(user, AdminPermissions.sellersView)) return <Forbidden />;

  const params = await searchParams;
  const page = parsePage(params.page);
  const status =
    params.status && (SettlementStatuses as readonly string[]).includes(params.status)
      ? params.status
      : '';
  const sellerId = pickUuid(params.sellerId);
  const hasFilters = Boolean(status || sellerId);

  const [result, seller] = await Promise.all([
    adminListSettlements({ page, limit: PAGE_SIZE, status, sellerId }),
    sellerId ? adminGetSeller(sellerId) : Promise.resolve(null),
  ]);

  return (
    <div>
      <PageHeader
        title={copy.title}
        description={`${copy.description} ${adminFa.common.total(formatPersianNumber(result.pagination.total))}`}
      />
      <form
        method="get"
        action="/admin/settlements"
        className="mb-4 flex flex-wrap items-end gap-3"
      >
        <SelectField
          label={adminFa.common.status}
          name="status"
          defaultValue={status}
          placeholder={copy.allStatuses}
          options={statusOptions}
        />
        {sellerId ? <input type="hidden" name="sellerId" value={sellerId} /> : null}
        <Button type="submit" variant="secondary">
          {adminFa.common.filter}
        </Button>
        {hasFilters ? (
          <Link
            href="/admin/settlements"
            className="inline-flex h-11 items-center px-2 text-sm text-ink-muted hover:text-brand-700"
          >
            {adminFa.common.clearFilters}
          </Link>
        ) : null}
      </form>
      {sellerId ? (
        <p className="mb-3 text-xs text-ink-muted">
          {copy.sellerFilter}:{' '}
          {seller ? (
            <Link href={`/admin/sellers/${seller.id}`} className="font-medium text-brand-700">
              {seller.storeName}
            </Link>
          ) : (
            <span dir="ltr" className="font-mono">
              {sellerId}
            </span>
          )}
        </p>
      ) : null}
      <DataTable
        columns={columns}
        empty={result.items.length === 0}
        emptyMessage={copy.empty}
        caption={copy.title}
      >
        {result.items.map((settlement) => (
          <tr key={settlement.id} className="hover:bg-surface-muted/60">
            <Td>
              <Link
                href={`/admin/sellers/${settlement.seller.id}`}
                className="font-medium hover:text-brand-700"
              >
                {settlement.seller.storeName}
              </Link>
            </Td>
            <Td className="tabular-nums">{formatPersianNumber(toToman(settlement.grossAmount))}</Td>
            <Td className="tabular-nums">
              {formatPersianNumber(toToman(settlement.commissionAmount))}
            </Td>
            <Td className="font-bold tabular-nums">
              {formatPersianNumber(toToman(settlement.netAmount))}
            </Td>
            <Td className="tabular-nums">{formatPersianNumber(settlement.itemCount)}</Td>
            <Td className="text-xs text-ink-muted">
              {settlementPeriod(settlement.periodStart, settlement.periodEnd)}
            </Td>
            <Td>
              <SettlementStatusBadge status={settlement.status} />
            </Td>
            <Td>
              <Link
                href={`/admin/settlements/${settlement.id}`}
                className="text-xs font-medium whitespace-nowrap hover:text-brand-700"
              >
                {formatJalaliDateTime(settlement.createdAt)}
              </Link>
            </Td>
          </tr>
        ))}
      </DataTable>
      <div className="mt-4">
        <Pagination
          pagination={result.pagination}
          hrefFor={pageHref('/admin/settlements', { status, sellerId })}
        />
      </div>
    </div>
  );
}
