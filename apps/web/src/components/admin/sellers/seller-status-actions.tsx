'use client';

import type { AdminSellerView, SellerStatus } from '@pe/shared';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { Notice } from '@/components/admin/notice';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextAreaField } from '@/components/ui/form-field';
import { t } from '@/i18n';
import { adminFa } from '@/i18n/admin-fa';
import { adminErrorMessage } from '@/lib/admin/errors';
import { browserApi } from '@/lib/api/client';

const copy = adminFa.sellers;
const REASON_MAX_LENGTH = 500;

type NextStatus = Exclude<SellerStatus, 'PENDING'>;

interface SellerStatusActionsProps {
  sellerId: string;
  status: SellerStatus;
  /** Called with the updated seller after a successful status change. */
  onChanged?: (seller: AdminSellerView) => void;
}

const successMessages: Record<NextStatus, string> = {
  APPROVED: copy.approved,
  SUSPENDED: copy.suspended,
  REJECTED: copy.rejected,
};

/**
 * Approve / suspend / reject controls for a seller. Rejecting is only
 * possible for pending applications and opens an inline form for the reason;
 * suspending asks for confirmation because it pulls the seller's offers.
 */
export function SellerStatusActions({ sellerId, status, onChanged }: SellerStatusActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<NextStatus | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);

  const change = async (next: NextStatus, statusReason?: string) => {
    setBusy(next);
    setNotice(null);
    try {
      const updated = await browserApi.patch<AdminSellerView>(
        `/admin/sellers/${encodeURIComponent(sellerId)}/status`,
        { status: next, reason: statusReason?.trim() || undefined },
      );
      setNotice({ tone: 'success', message: successMessages[next] });
      setRejecting(false);
      setReason('');
      onChanged?.(updated);
      router.refresh();
    } catch (error) {
      setNotice({ tone: 'error', message: adminErrorMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  const suspend = () => {
    if (!window.confirm(copy.suspendConfirm)) return;
    void change('SUSPENDED');
  };

  const submitReject = (event: FormEvent) => {
    event.preventDefault();
    void change('REJECTED', reason);
  };

  const canApprove = status !== 'APPROVED';
  const canSuspend = status === 'APPROVED';
  const canReject = status === 'PENDING';

  return (
    <div className="flex flex-col gap-3">
      {notice ? <Alert tone={notice.tone}>{notice.message}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        {canApprove ? (
          <Button
            loading={busy === 'APPROVED'}
            disabled={busy !== null}
            onClick={() => void change('APPROVED')}
          >
            {busy === 'APPROVED' ? copy.approving : copy.approve}
          </Button>
        ) : null}
        {canSuspend ? (
          <Button
            variant="danger"
            loading={busy === 'SUSPENDED'}
            disabled={busy !== null}
            onClick={suspend}
          >
            {busy === 'SUSPENDED' ? copy.suspending : copy.suspend}
          </Button>
        ) : null}
        {canReject ? (
          <Button
            variant={rejecting ? 'secondary' : 'danger'}
            aria-expanded={rejecting}
            disabled={busy !== null}
            onClick={() => setRejecting((value) => !value)}
          >
            {copy.reject}
          </Button>
        ) : null}
      </div>
      {rejecting && canReject ? (
        <form onSubmit={submitReject} className="flex flex-col gap-2">
          <TextAreaField
            label={copy.rejectReason}
            name="reason"
            value={reason}
            maxLength={REASON_MAX_LENGTH}
            hint={copy.rejectReasonHint}
            onChange={(event) => setReason(event.target.value)}
            className="min-h-20"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="danger"
              loading={busy === 'REJECTED'}
              disabled={busy !== null}
            >
              {busy === 'REJECTED' ? copy.rejecting : copy.confirmReject}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={() => setRejecting(false)}
            >
              {t.common.cancel}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
