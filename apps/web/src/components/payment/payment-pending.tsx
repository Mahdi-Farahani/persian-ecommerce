'use client';

import { paymentOutcomeOf, type PaymentView } from '@pe/shared';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { browserApi } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/error-message';

interface PaymentPendingProps {
  paymentId: string;
  /** Polling interval in milliseconds. */
  intervalMs?: number;
  /** Give up automatic polling after this many milliseconds. */
  timeoutMs?: number;
}

export const PENDING_POLL_INTERVAL_MS = 3_000;
export const PENDING_POLL_TIMEOUT_MS = 60_000;

/**
 * Polls the payment until the backend reports a final status, then routes to
 * the matching result page. A manual verify button re-queries the gateway.
 */
export function PaymentPending({
  paymentId,
  intervalMs = PENDING_POLL_INTERVAL_MS,
  timeoutMs = PENDING_POLL_TIMEOUT_MS,
}: PaymentPendingProps) {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settled = useRef(false);

  /** Routes to the final page when the payment is no longer pending. */
  const settle = useCallback(
    (payment: PaymentView): boolean => {
      const outcome = paymentOutcomeOf(payment.status);
      if (outcome === 'pending') return false;
      settled.current = true;
      router.replace(`/payment/${outcome}?paymentId=${encodeURIComponent(payment.id)}`);
      return true;
    },
    [router],
  );

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    const poll = async () => {
      if (!active || settled.current) return;
      try {
        const payment = await browserApi.get<PaymentView>(`/payments/${paymentId}`);
        if (!active || settle(payment)) return;
      } catch {
        // Transient errors are ignored; the next tick retries.
      }
      if (!active) return;
      if (Date.now() - startedAt >= timeoutMs) {
        setTimedOut(true);
        return;
      }
      timer = setTimeout(() => void poll(), intervalMs);
    };
    timer = setTimeout(() => void poll(), intervalMs);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [paymentId, intervalMs, timeoutMs, settle]);

  const verify = async () => {
    setVerifying(true);
    setError(null);
    try {
      const payment = await browserApi.post<PaymentView>(`/payments/${paymentId}/verify`, {});
      if (!settle(payment)) setTimedOut(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {timedOut ? (
        <Alert tone="warning">{t.payment.pendingTimedOut}</Alert>
      ) : (
        <p role="status" className="flex items-center gap-2 text-sm text-ink-muted">
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          {t.payment.pendingBody}
        </p>
      )}
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div>
        <Button variant="outline" loading={verifying} onClick={() => void verify()}>
          {verifying ? t.payment.checking : t.payment.checkStatus}
        </Button>
      </div>
    </div>
  );
}
