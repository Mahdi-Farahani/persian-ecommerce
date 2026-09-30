import {
  formatJalaliDateTime,
  formatPersianNumber,
  toPersianDigits,
  toToman,
  type AdminOrderSummary,
} from '@pe/shared';
import Link from 'next/link';
import { DataTable, Td } from '@/components/admin/data-table';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { adminFa } from '@/i18n/admin-fa';

const copy = adminFa.dashboard.recentOrders;

const columns = [
  { key: 'number', label: adminFa.orders.table.number },
  { key: 'customer', label: adminFa.orders.table.customer },
  { key: 'date', label: adminFa.orders.table.date },
  { key: 'total', label: adminFa.orders.table.total },
  { key: 'status', label: adminFa.orders.table.status },
] as const;

/** Latest orders with links to their detail pages. */
export function RecentOrders({ orders }: { orders: AdminOrderSummary[] }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold">{copy.title}</h2>
        <Link href="/admin/orders" className="text-xs font-medium text-brand-700 hover:underline">
          {copy.viewAll}
        </Link>
      </div>
      <DataTable
        columns={columns}
        empty={orders.length === 0}
        emptyMessage={copy.empty}
        caption={copy.title}
      >
        {orders.map((order) => (
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
            <Td>{order.customer.name || adminFa.orders.noName}</Td>
            <Td className="text-xs text-ink-muted">{formatJalaliDateTime(order.createdAt)}</Td>
            <Td className="tabular-nums">{formatPersianNumber(toToman(order.total))}</Td>
            <Td>
              <OrderStatusBadge status={order.status} />
            </Td>
          </tr>
        ))}
      </DataTable>
    </section>
  );
}
