'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { formatPersianNumber, type InventorySnapshot } from '@pe/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/form-field';
import { t } from '@/i18n';
import { browserApi } from '@/lib/api/client';
import { sellerErrorMessage } from '@/lib/seller/errors';
import { sellerStockAdjustSchema, type SellerStockAdjustFormValues } from '@/lib/seller/schemas';
import { cn } from '@/lib/utils';

const copy = t.seller.offers.adjust;

export interface StockAdjustFormProps {
  variantId: string;
  onSuccess?: (snapshot: InventorySnapshot) => void | Promise<void>;
  onCancel?: () => void;
  className?: string;
}

/** Signed stock adjustment of one of the seller's offers (`PATCH /seller/inventory/:id/adjust`). */
export function StockAdjustForm({
  variantId,
  onSuccess,
  onCancel,
  className,
}: StockAdjustFormProps) {
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SellerStockAdjustFormValues>({
    resolver: yupResolver(sellerStockAdjustSchema),
    defaultValues: { note: '' },
  });

  const submit = handleSubmit(async (values) => {
    setNotice(null);
    try {
      const snapshot = await browserApi.patch<InventorySnapshot>(
        `/seller/inventory/${encodeURIComponent(variantId)}/adjust`,
        { quantity: values.quantity, ...(values.note ? { note: values.note } : {}) },
      );
      reset({ note: '' });
      setNotice({
        tone: 'success',
        message: copy.done(formatPersianNumber(snapshot.availableQuantity)),
      });
      await onSuccess?.(snapshot);
    } catch (error) {
      setNotice({ tone: 'error', message: sellerErrorMessage(error) });
    }
  });

  return (
    <form onSubmit={submit} noValidate className={cn('flex flex-col gap-3', className)}>
      {notice ? <Alert tone={notice.tone}>{notice.message}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
        <TextField
          label={copy.quantity}
          inputMode="numeric"
          dir="ltr"
          className="text-left"
          hint={copy.quantityHint}
          error={errors.quantity?.message}
          {...register('quantity')}
        />
        <TextField label={copy.note} optional error={errors.note?.message} {...register('note')} />
        <div className="flex items-start gap-2 pt-7">
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
