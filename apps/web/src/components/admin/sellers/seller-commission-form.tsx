'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import type { AdminSellerView } from '@pe/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { Notice } from '@/components/admin/notice';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/form-field';
import { adminFa } from '@/i18n/admin-fa';
import { adminErrorMessage } from '@/lib/admin/errors';
import { commissionSchema, type CommissionFormValues } from '@/lib/admin/schemas';
import { bpsToPercent, formatCommissionPercent, percentToBps } from '@/lib/admin/sellers';
import { browserApi } from '@/lib/api/client';

const copy = adminFa.sellers.commission;

interface SellerCommissionFormProps {
  sellerId: string;
  /** Current commission in basis points (1000 = 10%). */
  commissionBps: number;
  onSaved?: (seller: AdminSellerView) => void;
}

/**
 * Commission editor. The admin types a percent (Persian digits and decimals
 * accepted); the API receives integer basis points (percent × 100).
 */
export function SellerCommissionForm({
  sellerId,
  commissionBps,
  onSaved,
}: SellerCommissionFormProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CommissionFormValues>({
    resolver: yupResolver(commissionSchema),
    // React Hook Form keeps the raw input value; the schema parses it.
    defaultValues: { percent: bpsToPercent(commissionBps) },
  });

  const submit = handleSubmit(async (values) => {
    setNotice(null);
    try {
      const seller = await browserApi.patch<AdminSellerView>(
        `/admin/sellers/${encodeURIComponent(sellerId)}/commission`,
        { commissionBps: percentToBps(values.percent) },
      );
      reset({ percent: bpsToPercent(seller.commissionBps) });
      setNotice({ tone: 'success', message: copy.saved });
      onSaved?.(seller);
      router.refresh();
    } catch (error) {
      setNotice({ tone: 'error', message: adminErrorMessage(error) });
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      {notice ? <Alert tone={notice.tone}>{notice.message}</Alert> : null}
      <p className="text-sm text-ink-muted">
        {copy.current(formatCommissionPercent(commissionBps))}
      </p>
      <TextField
        label={copy.percent}
        inputMode="decimal"
        dir="ltr"
        className="text-left"
        hint={copy.hint}
        error={errors.percent?.message}
        {...register('percent')}
      />
      <div>
        <Button type="submit" variant="secondary" loading={isSubmitting}>
          {copy.save}
        </Button>
      </div>
    </form>
  );
}
