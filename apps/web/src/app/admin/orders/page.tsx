import {
  OrderStatuses,
  formatJalaliDateTime,
  formatPersianNumber,
  toPersianDigits,
  toToman,
} from '@pe/shared';
import Link from 'next/link';
import { DataTable, Td } from '@/components/admin/data-table';
import { OrderFilters } from '@/components/admin/orders/order-filters';
import { PageHeader } from '@/components/admin/page-header';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { Pagination } from '@/components/ui/pagination';
import { adminFa } from '@/i18n/admin-fa';
import { adminListOrders, pageHref, parsePage } from '@/lib/admin/server';
import { requireUser } from '@/lib/auth/server';

export const metadata = { title: adminFa.orders.title };

const PAGE_SIZE = 20;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const columns = [
  { key: 'number', label: adminFa.orders.table.number },
  { key: 'customer', label: adminFa.orders.table.customer },
  { key: 'date', label: adminFa.orders.table.date },
  { key: 'items', label: adminFa.orders.table.items },
  { key: 'total', label: adminFa.orders.table.total },
  { key: 'status', label: adminFa.orders.table.status },
] as const;

function isoDate(value: string | undefined): string {
  return value && ISO_DATE.test(value) ? value : '';
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    from?: string;
    to?: string;
  }>;
}) {
  await requireUser('/admin/orders');
  const params = await searchParams;
  const page = parsePage(params.page);
  const search = params.search?.trim() ?? '';
  const status =
    params.status && (OrderStatuses as readonly string[]).includes(params.status)
      ? params.status
      : '';
  const from = isoDate(params.from);
  const to = isoDate(params.to);

  const result = await adminListOrders({ page, limit: PAGE_SIZE, search, status, from, to });

  return (
    <div>
      <PageHeader
        title={adminFa.orders.title}
        description={adminFa.common.total(formatPersianNumber(result.pagination.total))}
      />
      <OrderFilters search={search} status={status} from={from} to={to} />
      <DataTable
        columns={columns}
        empty={result.items.length === 0}
        emptyMessage={adminFa.orders.empty}
        caption={adminFa.orders.title}
      >
        {result.items.map((order) => (
          <tr key={order.id} className="hover:bg-surface-muted/60">
            <Td>
              <Link
                href={`/admin/orders/${order.id}`}
                className="font-medium tabular-nums hover:text-brand-700"
                dir="ltr"
              >
                {toPersianDigits(order.number)}
              </Link>
            </Td>
            <Td>
              <div className="flex flex-col">
                <span>{order.customer.name || adminFa.orders.noName}</span>
                <span className="text-xs text-ink-muted" dir="ltr">
                  {order.customer.email ??
                    (order.customer.phone ? toPersianDigits(order.customer.phone) : '')}
                </span>
              </div>
            </Td>
            <Td className="text-xs text-ink-muted">{formatJalaliDateTime(order.createdAt)}</Td>
            <Td className="tabular-nums">{formatPersianNumber(order.itemCount)}</Td>
            <Td className="tabular-nums">{formatPersianNumber(toToman(order.total))}</Td>
            <Td>
              <OrderStatusBadge status={order.status} />
            </Td>
          </tr>
        ))}
      </DataTable>
      <div className="mt-4">
        <Pagination
          pagination={result.pagination}
          hrefFor={pageHref('/admin/orders', { search, status, from, to })}
        />
      </div>
    </div>
  );
}
