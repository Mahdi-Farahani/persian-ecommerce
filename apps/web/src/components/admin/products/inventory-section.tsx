'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { formatPersianNumber, type VariantDetail } from '@pe/shared';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Badge } from '@/components/admin/badge';
import type { Notice } from '@/components/admin/notice';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/form-field';
import { adminFa } from '@/i18n/admin-fa';
import { adminErrorMessage } from '@/lib/admin/errors';
import { inventoryAdjustSchema, type InventoryAdjustFormValues } from '@/lib/admin/schemas';
import { InventoryAdjustmentTypes, type InventorySnapshot } from '@/lib/admin/types';
import { browserApi } from '@/lib/api/client';

interface InventorySectionProps {
  variants: VariantDetail[];
  canManage: boolean;
  /** Called after a successful adjustment so the parent can refresh stock. */
  onChanged?: () => Promise<void>;
}

const copy = adminFa.products.inventory;

const typeOptions = InventoryAdjustmentTypes.map((type) => ({
  value: type,
  label: copy.types[type] ?? type,
}));

export function InventorySection({ variants, canManage, onChanged }: InventorySectionProps) {
  return (
    <ul className="flex flex-col gap-4">
      {variants.map((variant) => (
        <li key={variant.id}>
          <InventoryRow variant={variant} canManage={canManage} onChanged={onChanged} />
        </li>
      ))}
    </ul>
  );
}

function InventoryRow({
  variant,
  canManage,
  onChanged,
}: {
  variant: VariantDetail;
  canManage: boolean;
  onChanged?: () => Promise<void>;
}) {
  const [snapshot, setSnapshot] = useState<InventorySnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

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

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InventoryAdjustFormValues>({
    resolver: yupResolver(inventoryAdjustSchema),
    defaultValues: { type: 'ADJUSTMENT', note: undefined },
  });

  const submit = handleSubmit(async (values) => {
    setNotice(null);
    try {
      const updated = await browserApi.patch<InventorySnapshot>(
        `/admin/inventory/${variant.id}/adjust`,
        {
          quantity: values.quantity,
          type: values.type,
          note: values.note,
        },
      );
      setSnapshot(updated);
      reset({ type: values.type, note: undefined });
      setNotice({ tone: 'success', message: copy.adjusted });
      await onChanged?.();
    } catch (error) {
      setNotice({ tone: 'error', message: adminErrorMessage(error) });
    }
  });

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span dir="ltr" className="font-mono text-sm font-bold">
          {variant.sku}
        </span>
        {variant.title ? <span className="text-sm text-ink-muted">{variant.title}</span> : null}
        {snapshot?.lowStock ? <Badge tone="warning">{copy.lowStock}</Badge> : null}
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
        <form
          onSubmit={submit}
          noValidate
          className="mt-4 flex flex-col gap-3 border-t border-border pt-4"
        >
          <p className="text-sm font-medium">{copy.adjust}</p>
          {notice ? <Alert tone={notice.tone}>{notice.message}</Alert> : null}
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto]">
            <TextField
              label={copy.quantity}
              inputMode="numeric"
              dir="ltr"
              className="text-left"
              error={errors.quantity?.message}
              {...register('quantity')}
            />
            <SelectField
              label={copy.type}
              options={typeOptions}
              error={errors.type?.message}
              {...register('type')}
            />
            <TextField
              label={copy.note}
              optional
              error={errors.note?.message}
              {...register('note')}
            />
            <Button type="submit" variant="secondary" className="mt-7" loading={isSubmitting}>
              {copy.submit}
            </Button>
          </div>
        </form>
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
