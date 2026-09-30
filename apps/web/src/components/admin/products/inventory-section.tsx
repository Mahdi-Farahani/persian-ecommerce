'use client';

import { formatPersianNumber, type InventorySnapshot, type VariantDetail } from '@pe/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/admin/badge';
import { InventoryAdjustForm } from '@/components/admin/inventory/inventory-adjust-form';
import { inventoryDetailHref } from '@/components/admin/inventory/inventory-row';
import { adminFa } from '@/i18n/admin-fa';
import { adminErrorMessage } from '@/lib/admin/errors';
import { browserApi } from '@/lib/api/client';

interface InventorySectionProps {
  productId: string;
  variants: VariantDetail[];
  canManage: boolean;
  /** Called after a successful adjustment so the parent can refresh stock. */
  onChanged?: () => Promise<void>;
}

const copy = adminFa.products.inventory;

export function InventorySection({
  productId,
  variants,
  canManage,
  onChanged,
}: InventorySectionProps) {
  return (
    <ul className="flex flex-col gap-4">
      {variants.map((variant) => (
        <li key={variant.id}>
          <InventoryRow
            productId={productId}
            variant={variant}
            canManage={canManage}
            onChanged={onChanged}
          />
        </li>
      ))}
    </ul>
  );
}

function InventoryRow({
  productId,
  variant,
  canManage,
  onChanged,
}: {
  productId: string;
  variant: VariantDetail;
  canManage: boolean;
  onChanged?: () => Promise<void>;
}) {
  const [snapshot, setSnapshot] = useState<InventorySnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    browserApi
      .get<InventorySnapshot>(`/admin/inventory/${variant.id}`)
      .then((loaded) => {
        if (cancelled) return;
        setSnapshot(loaded);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(adminErrorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, [variant.id]);

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span dir="ltr" className="font-mono text-sm font-bold">
          {variant.sku}
        </span>
        {variant.title ? <span className="text-sm text-ink-muted">{variant.title}</span> : null}
        {snapshot?.lowStock ? <Badge tone="warning">{copy.lowStock}</Badge> : null}
        <Link
          href={inventoryDetailHref(variant.id, productId)}
          className="ms-auto text-xs font-medium text-brand-700 hover:underline"
        >
          {adminFa.inventory.details}
        </Link>
      </div>
      {loadError ? (
        <p role="alert" className="mt-2 text-sm text-accent-600">
          {copy.loadError} {loadError}
        </p>
      ) : (
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat label={copy.stock} value={snapshot?.stockQuantity} />
          <Stat label={copy.reserved} value={snapshot?.reservedQuantity} />
          <Stat label={copy.available} value={snapshot?.availableQuantity} />
          <Stat label={copy.threshold} value={snapshot?.lowStockThreshold} />
        </dl>
      )}
      {canManage ? (
        <InventoryAdjustForm
          variantId={variant.id}
          title={copy.adjust}
          refresh={false}
          className="mt-4 border-t border-border pt-4"
          onSuccess={async (updated) => {
            setSnapshot(updated);
            await onChanged?.();
          }}
        />
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="font-bold tabular-nums">
        {value === undefined ? adminFa.common.loading : formatPersianNumber(value)}
      </dd>
    </div>
  );
}
