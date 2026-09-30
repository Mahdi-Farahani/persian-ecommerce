'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import type { AdminSettlementView } from '@pe/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { Notice } from '@/components/admin/notice';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/form-field';
import { adminFa } from '@/i18n/admin-fa';
import { adminErrorMessage } from '@/lib/admin/errors';
import { settlementPaymentSchema, type SettlementPaymentFormValues } from '@/lib/admin/schemas';
import { browserApi } from '@/lib/api/client';

const copy = adminFa.settlements;

interface SettlementActionsProps {
  settlement: AdminSettlementView;
  onChanged?: (settlement: AdminSettlementView) => void;
}

/**
 * "Mark paid" form (bank reference required) and a confirmed "cancel" action
 * for a pending settlement batch. Renders nothing once the batch is final.
 */
export function SettlementActions({ settlement, onChanged }: SettlementActionsProps) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SettlementPaymentFormValues>({
    resolver: yupResolver(settlementPaymentSchema),
    defaultValues: { paymentReference: '', note: undefined },
  });

  if (settlement.status !== 'PENDING') return null;

  const endpoint = `/admin/settlements/${encodeURIComponent(settlement.id)}`;
  const busy = isSubmitting || cancelling;

  const markPaid = handleSubmit(async (values) => {
    setNotice(null);
    try {
      const updated = await browserApi.patch<AdminSettlementView>(endpoint, {
        status: 'PAID',
        paymentReference: values.paymentReference,
        note: values.note,
      });
      setNotice({ tone: 'success', message: copy.paid });
      onChanged?.(updated);
      router.refresh();
    } catch (error) {
      setNotice({ tone: 'error', message: adminErrorMessage(error) });
    }
  });

  const cancel = async () => {
    if (!window.confirm(copy.cancelConfirm)) return;
    setCancelling(true);
    setNotice(null);
    try {
      const updated = await browserApi.patch<AdminSettlementView>(endpoint, {
        status: 'CANCELLED',
      });
      setNotice({ tone: 'success', message: copy.cancelled });
      onChanged?.(updated);
      router.refresh();
    } catch (error) {
      setNotice({ tone: 'error', message: adminErrorMessage(error) });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <form onSubmit={markPaid} noValidate className="flex flex-col gap-3">
      {notice ? <Alert tone={notice.tone}>{notice.message}</Alert> : null}
      <TextField
        label={copy.paymentReference}
        dir="ltr"
        className="text-left"
        hint={copy.paymentReferenceHint}
        error={errors.paymentReference?.message}
        {...register('paymentReference')}
      />
      <TextField label={copy.paymentNote} error={errors.note?.message} {...register('note')} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={isSubmitting} disabled={busy}>
          {isSubmitting ? copy.markingPaid : copy.markPaid}
        </Button>
        <Button
          type="button"
          variant="danger"
          loading={cancelling}
          disabled={busy}
          onClick={() => void cancel()}
        >
          {cancelling ? copy.cancelling : copy.cancel}
        </Button>
      </div>
    </form>
  );
}
