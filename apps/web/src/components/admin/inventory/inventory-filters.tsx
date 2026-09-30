import Link from 'next/link';
import { Checkbox } from '@/components/admin/checkbox';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/form-field';
import { adminFa } from '@/i18n/admin-fa';

export interface InventoryFilterValues {
  search: string;
  lowStock: boolean;
  outOfStock: boolean;
}

/** Server-rendered GET form: filters live in the URL so they survive reloads. */
export function InventoryFilters({ search, lowStock, outOfStock }: InventoryFilterValues) {
  const hasFilters = Boolean(search || lowStock || outOfStock);
  return (
    <form method="get" action="/admin/inventory" className="mb-4 flex flex-wrap items-end gap-3">
      <TextField
        label={adminFa.common.search}
        name="search"
        defaultValue={search}
        placeholder={adminFa.inventory.searchPlaceholder}
        containerClassName="min-w-56 flex-1"
      />
      <Checkbox
        label={adminFa.inventory.lowStockOnly}
        name="lowStock"
        value="true"
        defaultChecked={lowStock}
        containerClassName="h-11"
      />
      <Checkbox
        label={adminFa.inventory.outOfStockOnly}
        name="outOfStock"
        value="true"
        defaultChecked={outOfStock}
        containerClassName="h-11"
      />
      <Button type="submit" variant="secondary">
        {adminFa.common.filter}
      </Button>
      {hasFilters ? (
        <Link
          href="/admin/inventory"
          className="inline-flex h-11 items-center px-2 text-sm text-ink-muted hover:text-brand-700"
        >
          {adminFa.common.clearFilters}
        </Link>
      ) : null}
    </form>
  );
}
