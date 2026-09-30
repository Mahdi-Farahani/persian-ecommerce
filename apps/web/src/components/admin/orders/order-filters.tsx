import { OrderStatuses } from '@pe/shared';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/form-field';
import { adminFa } from '@/i18n/admin-fa';
import { orderStatusLabel } from '@/lib/orders/status';

export interface OrderFilterValues {
  search: string;
  status: string;
  from: string;
  to: string;
}

const statusOptions = OrderStatuses.map((status) => ({
  value: status,
  label: orderStatusLabel(status),
}));

/** Server-rendered GET form: filters live in the URL so they survive reloads. */
export function OrderFilters({ search, status, from, to }: OrderFilterValues) {
  const hasFilters = Boolean(search || status || from || to);
  return (
    <form method="get" action="/admin/orders" className="mb-4 flex flex-wrap items-end gap-3">
      <TextField
        label={adminFa.common.search}
        name="search"
        defaultValue={search}
        placeholder={adminFa.orders.searchPlaceholder}
        containerClassName="min-w-56 flex-1"
      />
      <SelectField
        label={adminFa.common.status}
        name="status"
        defaultValue={status}
        placeholder={adminFa.orders.allStatuses}
        options={statusOptions}
      />
      <TextField
        label={adminFa.orders.from}
        name="from"
        type="date"
        defaultValue={from}
        dir="ltr"
      />
      <TextField label={adminFa.orders.to} name="to" type="date" defaultValue={to} dir="ltr" />
      <Button type="submit" variant="secondary">
        {adminFa.common.filter}
      </Button>
      {hasFilters ? (
        <Link
          href="/admin/orders"
          className="inline-flex h-11 items-center px-2 text-sm text-ink-muted hover:text-brand-700"
        >
          {adminFa.common.clearFilters}
        </Link>
      ) : null}
    </form>
  );
}
