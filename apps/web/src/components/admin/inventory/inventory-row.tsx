'use client';

import { formatPersianNumber, type InventoryItemView } from '@pe/shared';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, productStatusTone } from '@/components/admin/badge';
import { Td } from '@/components/admin/data-table';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { adminFa } from '@/i18n/admin-fa';
import { assetUrl } from '@/lib/assets';
import { InventoryAdjustForm } from './inventory-adjust-form';
import { InventoryThresholdForm } from './inventory-threshold-form';

const copy = adminFa.inventory;

type Editor = 'closed' | 'adjust' | 'threshold';

/** Detail page link; the product id lets the page resolve the variant's identity. */
export function inventoryDetailHref(variantId: string, productId?: string): string {
  const base = `/admin/inventory/${encodeURIComponent(variantId)}`;
  return productId ? `${base}?product=${encodeURIComponent(productId)}` : base;
}

interface InventoryRowProps {
  item: InventoryItemView;
  canManage: boolean;
  /** Number of table columns, for the inline editor row. */
  columnCount: number;
}

/** Table row plus an optional inline editor row underneath it. */
export function InventoryRow({ item, canManage, columnCount }: InventoryRowProps) {
  const [editor, setEditor] = useState<Editor>('closed');
  const image = assetUrl(item.imageUrl);
  const close = () => setEditor('closed');
  const toggle = (next: Exclude<Editor, 'closed'>) =>
    setEditor((current) => (current === next ? 'closed' : next));

  return (
    <>
      <tr className="hover:bg-surface-muted/60">
        <Td>
          <div className="relative size-12 overflow-hidden rounded-lg border border-border bg-surface-muted">
            {image ? (
              <Image src={image} alt="" fill sizes="48px" className="object-cover" unoptimized />
            ) : (
              <span className="grid h-full place-items-center text-[10px] text-ink-muted">
                {t.catalog.noImage}
              </span>
            )}
          </div>
        </Td>
        <Td>
          <Link
            href={`/admin/products/${item.productId}`}
            className="font-medium hover:text-brand-700"
          >
            {item.productTitle}
          </Link>
          <span className="mt-1 block">
            <Badge tone={productStatusTone(item.productStatus)}>
              {adminFa.products.status[item.productStatus] ?? item.productStatus}
            </Badge>
          </span>
        </Td>
        <Td>
          <span dir="ltr" className="inline-block font-mono text-xs">
            {item.sku}
          </span>
        </Td>
        <Td className="text-ink-muted">
          <span className="block">{item.variantTitle || adminFa.common.none}</span>
          <Badge tone={item.variantStatus === 'ACTIVE' ? 'success' : 'neutral'} className="mt-1">
            {adminFa.products.variants.statusLabels[item.variantStatus] ?? item.variantStatus}
          </Badge>
        </Td>
        <Td className="tabular-nums">{formatPersianNumber(item.stockQuantity)}</Td>
        <Td className="tabular-nums">{formatPersianNumber(item.reservedQuantity)}</Td>
        <Td className="font-bold tabular-nums">{formatPersianNumber(item.availableQuantity)}</Td>
        <Td className="tabular-nums">{formatPersianNumber(item.lowStockThreshold)}</Td>
        <Td>
          <StockBadge item={item} />
        </Td>
        <Td>
          <div className="flex flex-wrap items-center justify-end gap-1">
            {canManage ? (
              <>
                <Button
                  size="sm"
                  variant={editor === 'adjust' ? 'secondary' : 'outline'}
                  aria-expanded={editor === 'adjust'}
                  onClick={() => toggle('adjust')}
                >
                  {copy.adjust}
                </Button>
                <Button
                  size="sm"
                  variant={editor === 'threshold' ? 'secondary' : 'ghost'}
                  aria-expanded={editor === 'threshold'}
                  onClick={() => toggle('threshold')}
                >
                  {copy.editThreshold}
                </Button>
              </>
            ) : null}
            <Link
              href={inventoryDetailHref(item.variantId, item.productId)}
              className="inline-flex h-9 items-center rounded-lg px-3 text-xs font-medium text-brand-700 hover:underline"
            >
              {copy.details}
            </Link>
          </div>
        </Td>
      </tr>
      {editor !== 'closed' ? (
        <tr className="bg-surface-muted/40">
          <td colSpan={columnCount} className="px-3 py-3">
            {editor === 'adjust' ? (
              <InventoryAdjustForm
                variantId={item.variantId}
                title={`${copy.adjust} — ${item.sku}`}
                onSuccess={close}
                onCancel={close}
              />
            ) : (
              <InventoryThresholdForm
                variantId={item.variantId}
                current={item.lowStockThreshold}
                onSuccess={close}
                onCancel={close}
              />
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function StockBadge({
  item,
}: {
  item: Pick<InventoryItemView, 'availableQuantity' | 'lowStock'>;
}) {
  if (item.availableQuantity <= 0) return <Badge tone="danger">{copy.outOfStock}</Badge>;
  if (item.lowStock) return <Badge tone="warning">{copy.lowStock}</Badge>;
  return <Badge tone="success">{adminFa.products.inStock}</Badge>;
}
