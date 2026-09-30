import { formatJalaliDateTime, formatPersianNumber, hasPermission } from '@pe/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Forbidden } from '@/components/admin/forbidden';
import { InventoryAdjustForm } from '@/components/admin/inventory/inventory-adjust-form';
import { InventoryLedger } from '@/components/admin/inventory/inventory-ledger';
import { StockBadge } from '@/components/admin/inventory/inventory-row';
import { InventoryThresholdForm } from '@/components/admin/inventory/inventory-threshold-form';
import { PageHeader } from '@/components/admin/page-header';
import { Card, CardTitle } from '@/components/ui/card';
import { adminFa } from '@/i18n/admin-fa';
import { AdminPermissions } from '@/lib/admin/navigation';
import {
  adminGetInventory,
  adminInventoryTransactions,
  adminListInventory,
} from '@/lib/admin/server';
import { requireUser } from '@/lib/auth/server';

export const metadata = { title: adminFa.inventory.detailTitle };

const copy = adminFa.inventory;

/** Upper bound on variants per product; enough to find the row by variant id. */
const PRODUCT_VARIANTS_LIMIT = 100;

export default async function AdminInventoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ variantId: string }>;
  searchParams: Promise<{ product?: string }>;
}) {
  const [{ variantId }, { product: productId }] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/admin/inventory/${variantId}`);
  if (!hasPermission(user, AdminPermissions.inventoryView)) return <Forbidden />;
  const canManage = hasPermission(user, AdminPermissions.inventoryManage);

  const snapshot = await adminGetInventory(variantId);
  if (!snapshot) notFound();

  // Only the list endpoint joins product/variant identity, and it filters by
  // product rather than variant, so links pass the product id as a hint.
  const [transactions, listing] = await Promise.all([
    adminInventoryTransactions(variantId),
    productId
      ? adminListInventory({ productId, limit: PRODUCT_VARIANTS_LIMIT })
      : Promise.resolve(null),
  ]);
  const item = listing?.items.find((row) => row.variantId === variantId);

  const stats = [
    { label: copy.stock, value: snapshot.stockQuantity },
    { label: copy.reserved, value: snapshot.reservedQuantity },
    { label: copy.available, value: snapshot.availableQuantity },
    { label: copy.threshold, value: snapshot.lowStockThreshold },
  ];

  return (
    <div>
      <PageHeader
        title={item ? item.productTitle : copy.detailTitle}
        description={
          item
            ? [item.sku, item.variantTitle].filter(Boolean).join(' — ')
            : `${adminFa.common.id}: ${variantId}`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StockBadge item={snapshot} />
            {item ? (
              <Link
                href={`/admin/products/${item.productId}`}
                className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-medium hover:border-brand-400 hover:text-brand-700"
              >
                {copy.viewProduct}
              </Link>
            ) : null}
            <Link
              href="/admin/inventory"
              className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-medium hover:border-brand-400 hover:text-brand-700"
            >
              {copy.title}
            </Link>
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          {canManage ? (
            <Card>
              <CardTitle>{copy.adjust}</CardTitle>
              <InventoryAdjustForm key={snapshot.updatedAt} variantId={variantId} />
            </Card>
          ) : null}
          <Card>
            <CardTitle>{copy.ledger}</CardTitle>
            <InventoryLedger transactions={transactions} />
          </Card>
        </div>
        <aside className="flex flex-col gap-6">
          <Card>
            <CardTitle>{copy.snapshot}</CardTitle>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dt className="text-xs text-ink-muted">{stat.label}</dt>
                  <dd className="text-xl font-bold tabular-nums">
                    {formatPersianNumber(stat.value)}
                  </dd>
                </div>
              ))}
              <div className="col-span-2">
                <dt className="text-xs text-ink-muted">{copy.updatedAt}</dt>
                <dd className="font-medium">{formatJalaliDateTime(snapshot.updatedAt)}</dd>
              </div>
            </dl>
          </Card>
          {canManage ? (
            <Card>
              <CardTitle>{copy.editThreshold}</CardTitle>
              <InventoryThresholdForm
                key={snapshot.lowStockThreshold}
                variantId={variantId}
                current={snapshot.lowStockThreshold}
              />
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
