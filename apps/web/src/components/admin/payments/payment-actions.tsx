'use client';

import type { AdminPaymentDetail, ReconcileResult } from '@pe/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/form-field';
import { adminFa } from '@/i18n/admin-fa';
import { adminErrorMessage } from '@/lib/admin/errors';
import { browserApi } from '@/lib/api/client';

const copy = adminFa.payments;
const REASON_MAX_LENGTH = 300;

interface PaymentActionsProps {
  payment: AdminPaymentDetail;
  canReconcile: boolean;
  canRefund: boolean;
}

/** Reconcile / refund controls for a payment; both confirm before calling the API. */
export function PaymentActions({ payment, canReconcile, canRefund }: PaymentActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<'reconcile' | 'refund' | null>(null);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const reconcile = async () => {
    if (!window.confirm(copy.reconcileConfirm)) return;
    setBusy('reconcile');
    setNotice(null);
    try {
      const result = await browserApi.post<ReconcileResult>(
        `/admin/payments/${payment.id}/reconcile`,
        {},
      );
      const providerStatus = copy.providerStatuses[result.providerStatus] ?? result.providerStatus;
      const summary = result.changed ? copy.reconcileChanged : copy.reconcileUnchanged;
      setNotice({
        tone: 'success',
        message: `${summary} ${copy.providerStatus}: ${providerStatus}. ${result.message}`,
      });
      router.refresh();
    } catch (error) {
      setNotice({ tone: 'error', message: adminErrorMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  const refund = async () => {
    if (!window.confirm(copy.refundConfirm)) return;
    setBusy('refund');
    setNotice(null);
    try {
      await browserApi.post<AdminPaymentDetail>(`/admin/payments/${payment.id}/refund`, {
        reason: reason.trim() || undefined,
      });
      setNotice({ tone: 'success', message: copy.refunded });
      setReason('');
      router.refresh();
    } catch (error) {
      setNotice({ tone: 'error', message: adminErrorMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  const refundable = canRefund && payment.status === 'PAID';
  if (!canReconcile && !refundable) return null;

  return (
    <div className="flex flex-col gap-3">
      {notice ? <Alert tone={notice.tone}>{notice.message}</Alert> : null}
      {refundable ? (
        <TextField
          label={copy.refundReason}
          name="reason"
          maxLength={REASON_MAX_LENGTH}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        {canReconcile ? (
          <Button
            variant="outline"
            loading={busy === 'reconcile'}
            disabled={busy !== null}
            onClick={() => void reconcile()}
          >
            {busy === 'reconcile' ? copy.reconciling : copy.reconcile}
          </Button>
        ) : null}
        {refundable ? (
          <Button
            variant="danger"
            loading={busy === 'refund'}
            disabled={busy !== null}
            onClick={() => void refund()}
          >
            {busy === 'refund' ? copy.refunding : copy.refund}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
