import {
  formatJalaliDate,
  formatPersianNumber,
  hasPermission,
  toPersianDigits,
  toToman,
} from '@pe/shared';
import Link from 'next/link';
import { Badge } from '@/components/admin/badge';
import { DataTable, Td } from '@/components/admin/data-table';
import { Forbidden } from '@/components/admin/forbidden';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/form-field';
import { Pagination } from '@/components/ui/pagination';
import { adminFa } from '@/i18n/admin-fa';
import { couponLifecycle, type CouponLifecycle } from '@/lib/admin/coupon-mappers';
import { AdminPermissions } from '@/lib/admin/navigation';
import { adminListCoupons, pageHref, parsePage } from '@/lib/admin/server';
import type { AdminCoupon } from '@/lib/admin/types';
import { requireUser } from '@/lib/auth/server';

export const metadata = { title: adminFa.coupons.title };

const copy = adminFa.coupons;
const PAGE_SIZE = 20;

const columns = [
  { key: 'code', label: copy.table.code },
  { key: 'type', label: copy.table.type },
  { key: 'value', label: copy.table.value },
  { key: 'usage', label: copy.table.usage },
  { key: 'period', label: copy.table.period },
  { key: 'status', label: copy.table.status },
] as const;

const activeOptions = [
  { value: 'true', label: copy.activeOnly },
  { value: 'false', label: copy.inactiveOnly },
];

const lifecycleBadge: Record<
  CouponLifecycle,
  { tone: 'success' | 'neutral' | 'warning' | 'info'; label: string }
> = {
  active: { tone: 'success', label: adminFa.common.active },
  inactive: { tone: 'neutral', label: adminFa.common.inactive },
  scheduled: { tone: 'info', label: copy.scheduled },
  expired: { tone: 'warning', label: copy.expired },
  exhausted: { tone: 'warning', label: copy.exhausted },
};

function couponValue(coupon: AdminCoupon): string {
  return coupon.type === 'PERCENTAGE'
    ? copy.percentValue(toPersianDigits(coupon.value))
    : formatPersianNumber(toToman(coupon.value));
}

function couponPeriod(coupon: AdminCoupon): string {
  const parts: string[] = [];
  if (coupon.startsAt) parts.push(copy.fromDate(formatJalaliDate(coupon.startsAt)));
  if (coupon.endsAt) parts.push(copy.toDate(formatJalaliDate(coupon.endsAt)));
  return parts.length > 0 ? parts.join(' ') : copy.noPeriod;
}

export default async function AdminCouponsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; isActive?: string }>;
}) {
  const user = await requireUser('/admin/coupons');
  if (!hasPermission(user, AdminPermissions.discountsManage)) return <Forbidden />;

  const params = await searchParams;
  const page = parsePage(params.page);
  const search = params.search?.trim() ?? '';
  const isActive = params.isActive === 'true' || params.isActive === 'false' ? params.isActive : '';
  const hasFilters = Boolean(search || isActive);

  const result = await adminListCoupons({ page, limit: PAGE_SIZE, search, isActive });
  const now = new Date();

  return (
    <div>
      <PageHeader
        title={copy.title}
        description={adminFa.common.total(formatPersianNumber(result.pagination.total))}
        actions={
          <Link
            href="/admin/coupons/new"
            className="inline-flex h-11 items-center rounded-lg bg-brand-600 px-5 text-sm font-bold text-white transition hover:bg-brand-700"
          >
            {copy.add}
          </Link>
        }
      />
      <form method="get" action="/admin/coupons" className="mb-4 flex flex-wrap items-end gap-3">
        <TextField
          label={adminFa.common.search}
          name="search"
          defaultValue={search}
          placeholder={copy.searchPlaceholder}
          containerClassName="min-w-56 flex-1"
        />
        <SelectField
          label={adminFa.common.status}
          name="isActive"
          defaultValue={isActive}
          placeholder={copy.allStatuses}
          options={activeOptions}
        />
        <Button type="submit" variant="secondary">
          {adminFa.common.filter}
        </Button>
        {hasFilters ? (
          <Link
            href="/admin/coupons"
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
        {result.items.map((coupon) => {
          const badge = lifecycleBadge[couponLifecycle(coupon, now)];
          return (
            <tr key={coupon.id} className="hover:bg-surface-muted/60">
              <Td>
                <Link
                  href={`/admin/coupons/${coupon.id}`}
                  className="font-mono font-medium hover:text-brand-700"
                  dir="ltr"
                >
                  {coupon.code}
                </Link>
                {coupon.description ? (
                  <span className="block max-w-xs truncate text-xs text-ink-muted">
                    {coupon.description}
                  </span>
                ) : null}
              </Td>
              <Td>
                <Badge tone={coupon.type === 'PERCENTAGE' ? 'info' : 'neutral'}>
                  {copy.types[coupon.type] ?? coupon.type}
                </Badge>
              </Td>
              <Td className="tabular-nums">{couponValue(coupon)}</Td>
              <Td className="tabular-nums">
                {copy.usage(
                  formatPersianNumber(coupon.usedCount),
                  coupon.usageLimit === null
                    ? copy.unlimited
                    : formatPersianNumber(coupon.usageLimit),
                )}
              </Td>
              <Td className="text-xs text-ink-muted">{couponPeriod(coupon)}</Td>
              <Td>
                <Badge tone={badge.tone}>{badge.label}</Badge>
              </Td>
            </tr>
          );
        })}
      </DataTable>
      <div className="mt-4">
        <Pagination
          pagination={result.pagination}
          hrefFor={pageHref('/admin/coupons', { search, isActive })}
        />
      </div>
    </div>
  );
}
