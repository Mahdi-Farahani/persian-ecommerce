import { formatPersianNumber, hasPermission, type InventorySummary } from '@pe/shared';
import { DataTable } from '@/components/admin/data-table';
import { Forbidden } from '@/components/admin/forbidden';
import { InventoryFilters } from '@/components/admin/inventory/inventory-filters';
import { InventoryRow } from '@/components/admin/inventory/inventory-row';
import { PageHeader } from '@/components/admin/page-header';
import { Card } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { adminFa } from '@/i18n/admin-fa';
import { AdminPermissions } from '@/lib/admin/navigation';
import { adminInventorySummary, adminListInventory, pageHref, parsePage } from '@/lib/admin/server';
import { requireUser } from '@/lib/auth/server';
import { cn } from '@/lib/utils';

export const metadata = { title: adminFa.inventory.title };

const copy = adminFa.inventory;
const PAGE_SIZE = 20;

const columns = [
  { key: 'image', label: copy.table.image, className: 'w-16' },
  { key: 'product', label: copy.table.product },
  { key: 'sku', label: copy.table.sku },
  { key: 'variant', label: copy.table.variant },
  { key: 'stock', label: copy.table.stock },
  { key: 'reserved', label: copy.table.reserved },
  { key: 'available', label: copy.table.available },
  { key: 'threshold', label: copy.table.threshold },
  { key: 'status', label: copy.table.status },
  { key: 'actions', label: adminFa.common.actions, srOnly: true, className: 'w-px' },
] as const;

const summaryCards: Array<{
  key: keyof InventorySummary;
  label: string;
  tone?: 'warning' | 'danger';
}> = [
  { key: 'trackedVariants', label: copy.summary.trackedVariants },
  { key: 'lowStockVariants', label: copy.summary.lowStockVariants, tone: 'warning' },
  { key: 'outOfStockVariants', label: copy.summary.outOfStockVariants, tone: 'danger' },
  { key: 'reservedUnits', label: copy.summary.reservedUnits },
  { key: 'stockUnits', label: copy.summary.stockUnits },
];

const toneClass = { warning: 'text-amber-700', danger: 'text-accent-600' } as const;

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    lowStock?: string;
    outOfStock?: string;
  }>;
}) {
  const user = await requireUser('/admin/inventory');
  if (!hasPermission(user, AdminPermissions.inventoryView)) return <Forbidden />;
  const canManage = hasPermission(user, AdminPermissions.inventoryManage);

  const params = await searchParams;
  const page = parsePage(params.page);
  const search = params.search?.trim() ?? '';
  const lowStock = params.lowStock === 'true';
  const outOfStock = params.outOfStock === 'true';

  const [summary, result] = await Promise.all([
    adminInventorySummary(),
    adminListInventory({
      page,
      limit: PAGE_SIZE,
      search,
      lowStock: lowStock ? 'true' : undefined,
      outOfStock: outOfStock ? 'true' : undefined,
    }),
  ]);

  return (
    <div>
      <PageHeader title={copy.title} description={copy.description} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <Card key={card.key} className="p-4 sm:p-4">
            <p className="text-xs text-ink-muted">{card.label}</p>
            <p
              className={cn(
                'mt-1 text-2xl font-bold tabular-nums',
                card.tone && summary[card.key] > 0 ? toneClass[card.tone] : undefined,
              )}
            >
              {formatPersianNumber(summary[card.key])}
            </p>
          </Card>
        ))}
      </div>
      <InventoryFilters search={search} lowStock={lowStock} outOfStock={outOfStock} />
      <p className="mb-2 text-sm text-ink-muted">
        {adminFa.common.total(formatPersianNumber(result.pagination.total))}
      </p>
      <DataTable
        columns={columns}
        empty={result.items.length === 0}
        emptyMessage={copy.empty}
        caption={copy.title}
      >
        {result.items.map((item) => (
          <InventoryRow
            key={item.variantId}
            item={item}
            canManage={canManage}
            columnCount={columns.length}
          />
        ))}
      </DataTable>
      <div className="mt-4">
        <Pagination
          pagination={result.pagination}
          hrefFor={pageHref('/admin/inventory', {
            search,
            lowStock: lowStock ? 'true' : undefined,
            outOfStock: outOfStock ? 'true' : undefined,
          })}
        />
      </div>
    </div>
  );
}
