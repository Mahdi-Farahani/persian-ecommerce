'use client';

import type { AdminReviewView, ReviewStatus } from '@pe/shared';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextAreaField } from '@/components/ui/form-field';
import { t } from '@/i18n';
import { adminFa } from '@/i18n/admin-fa';
import { adminErrorMessage } from '@/lib/admin/errors';
import { browserApi } from '@/lib/api/client';
import { cn } from '@/lib/utils';

const copy = adminFa.reviews;
const NOTE_MAX_LENGTH = 500;

interface ReviewModerationActionsProps {
  reviewId: string;
  status: ReviewStatus;
  /** Smaller buttons and an end-aligned layout for table rows. */
  compact?: boolean;
  /** Called with the updated review after a successful status change. */
  onChanged?: (review: AdminReviewView) => void;
}

/**
 * Approve / reject controls for a review. Rejecting opens an inline form so
 * the moderator can attach an optional note that the customer will see.
 */
export function ReviewModerationActions({
  reviewId,
  status,
  compact = false,
  onChanged,
}: ReviewModerationActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const moderate = async (next: Exclude<ReviewStatus, 'PENDING'>, moderationNote?: string) => {
    setBusy(next === 'APPROVED' ? 'approve' : 'reject');
    setNotice(null);
    try {
      const updated = await browserApi.patch<AdminReviewView>(
        `/admin/reviews/${encodeURIComponent(reviewId)}/status`,
        { status: next, note: moderationNote?.trim() || undefined },
      );
      setNotice({
        tone: 'success',
        message: next === 'APPROVED' ? copy.approved : copy.rejected,
      });
      setRejecting(false);
      setNote('');
      onChanged?.(updated);
      router.refresh();
    } catch (error) {
      setNotice({ tone: 'error', message: adminErrorMessage(error) });
    } finally {
      setBusy(null);
    }
  };

  const submitReject = (event: FormEvent) => {
    event.preventDefault();
    void moderate('REJECTED', note);
  };

  const canApprove = status !== 'APPROVED';
  const canReject = status !== 'REJECTED';
  const size = compact ? 'sm' : 'md';

  return (
    <div className={cn('flex flex-col gap-2', compact ? 'items-end' : 'items-stretch')}>
      {notice ? (
        compact ? (
          <p
            role={notice.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'text-xs',
              notice.tone === 'error' ? 'text-accent-600' : 'text-green-700',
            )}
          >
            {notice.message}
          </p>
        ) : (
          <Alert tone={notice.tone}>{notice.message}</Alert>
        )
      ) : null}
      <div className={cn('flex flex-wrap gap-2', compact && 'justify-end')}>
        {canApprove ? (
          <Button
            size={size}
            loading={busy === 'approve'}
            disabled={busy !== null}
            onClick={() => void moderate('APPROVED')}
          >
            {busy === 'approve' ? copy.approving : copy.approve}
          </Button>
        ) : null}
        {canReject ? (
          <Button
            size={size}
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
        <form
          onSubmit={submitReject}
          className={cn('flex w-full flex-col gap-2', compact && 'min-w-64 text-start')}
        >
          <TextAreaField
            label={copy.rejectNote}
            name="note"
            value={note}
            maxLength={NOTE_MAX_LENGTH}
            hint={copy.rejectNoteHint}
            onChange={(event) => setNote(event.target.value)}
            className="min-h-20"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              size={size}
              variant="danger"
              loading={busy === 'reject'}
              disabled={busy !== null}
            >
              {busy === 'reject' ? copy.rejecting : copy.confirmReject}
            </Button>
            <Button
              type="button"
              size={size}
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
