'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import type { InventorySnapshot } from '@pe/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { Notice } from '@/components/admin/notice';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/form-field';
import { t } from '@/i18n';
import { adminFa } from '@/i18n/admin-fa';
import { adminErrorMessage } from '@/lib/admin/errors';
import { inventoryAdjustSchema, type InventoryAdjustFormValues } from '@/lib/admin/schemas';
import { InventoryAdjustmentTypes } from '@/lib/admin/types';
import { browserApi } from '@/lib/api/client';
import { cn } from '@/lib/utils';

const copy = adminFa.products.inventory;

const typeOptions = InventoryAdjustmentTypes.map((type) => ({
  value: type,
  label: copy.types[type] ?? type,
}));

export interface InventoryAdjustFormProps {
  variantId: string;
  /** Receives the fresh snapshot after a successful adjustment. */
  onSuccess?: (snapshot: InventorySnapshot) => void | Promise<void>;
  onCancel?: () => void;
  /** Re-renders the surrounding server page after success (default: true). */
  refresh?: boolean;
  /** Renders the heading above the fields. */
  title?: string;
  className?: string;
}

/**
 * Signed stock adjustment (`PATCH /admin/inventory/:id/adjust`). Shared by the
 * inventory dashboard, the variant detail page and the product editor.
 */
export function InventoryAdjustForm({
  variantId,
  onSuccess,
  onCancel,
  refresh = true,
  title,
  className,
}: InventoryAdjustFormProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(null);
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
      const snapshot = await browserApi.patch<InventorySnapshot>(
        `/admin/inventory/${encodeURIComponent(variantId)}/adjust`,
        { quantity: values.quantity, type: values.type, note: values.note },
      );
      reset({ type: values.type, note: undefined });
      setNotice({ tone: 'success', message: copy.adjusted });
      if (refresh) router.refresh();
      await onSuccess?.(snapshot);
    } catch (error) {
      setNotice({ tone: 'error', message: adminErrorMessage(error) });
    }
  });

  return (
    <form onSubmit={submit} noValidate className={cn('flex flex-col gap-3', className)}>
      {title ? <p className="text-sm font-medium">{title}</p> : null}
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
        <TextField label={copy.note} optional error={errors.note?.message} {...register('note')} />
        <div className="flex items-end gap-2">
          <Button type="submit" variant="secondary" loading={isSubmitting}>
            {copy.submit}
          </Button>
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
              {t.common.cancel}
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  );
}
