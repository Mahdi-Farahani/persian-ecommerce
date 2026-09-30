import { ProductStatuses } from '@pe/shared';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/form-field';
import { adminFa } from '@/i18n/admin-fa';

interface ProductFiltersProps {
  search: string;
  status: string;
}

const statusOptions = ProductStatuses.map((status) => ({
  value: status,
  label: adminFa.products.status[status] ?? status,
}));

/** Server-rendered GET form: filters live in the URL so they survive reloads. */
export function ProductFilters({ search, status }: ProductFiltersProps) {
  const hasFilters = Boolean(search || status);
  return (
    <form method="get" action="/admin/products" className="mb-4 flex flex-wrap items-end gap-3">
      <TextField
        label={adminFa.common.search}
        name="search"
        defaultValue={search}
        placeholder={adminFa.products.searchPlaceholder}
        containerClassName="min-w-56 flex-1"
      />
      <SelectField
        label={adminFa.common.status}
        name="status"
        defaultValue={status}
        placeholder={adminFa.common.all}
        options={statusOptions}
      />
      <Button type="submit" variant="secondary">
        {adminFa.common.filter}
      </Button>
      {hasFilters ? (
        <Link
          href="/admin/products"
          className="inline-flex h-11 items-center px-2 text-sm text-ink-muted hover:text-brand-700"
        >
          {adminFa.common.clearFilters}
        </Link>
      ) : null}
    </form>
  );
}
