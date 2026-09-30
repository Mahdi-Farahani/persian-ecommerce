import { paymentOutcomeOf, type PaymentOutcome, type PaymentView } from '@pe/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PayOrderButton } from '@/components/payment/pay-order-button';
import { PaymentPending } from '@/components/payment/payment-pending';
import { PaymentSummary } from '@/components/payment/payment-summary';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

interface PaymentResultProps {
  /** Null when the id was missing or the payment could not be loaded. */
  payment: PaymentView | null;
  /** Gateway reason code forwarded on the failure URL. */
  reason?: string;
}

const linkClass =
  'inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-bold transition';
const primaryLink = cn(linkClass, 'bg-brand-600 text-white hover:bg-brand-700');
const outlineLink = cn(
  linkClass,
  'border border-border bg-surface text-ink hover:border-brand-400 hover:text-brand-700',
);

/**
 * Renders the outcome of a payment from the backend status (never from the
 * URL the gateway sent the customer to).
 */
export function PaymentResult({ payment, reason }: PaymentResultProps) {
  if (!payment) {
    return (
      <ResultCard outcome="failure" title={t.payment.failureTitle}>
        <p className="text-sm text-ink-muted">{t.payment.missingId}</p>
        {reason ? <ReasonLine reason={reason} /> : null}
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/account/orders" className={primaryLink}>
            {t.payment.myOrders}
          </Link>
        </div>
      </ResultCard>
    );
  }

  const outcome = paymentOutcomeOf(payment.status);
  const orderHref = `/account/orders/${payment.orderId}`;

  if (outcome === 'success') {
    return (
      <ResultCard outcome="success" title={t.payment.successTitle}>
        <p className="text-sm text-ink-muted">{t.payment.successBody}</p>
        <PaymentSummary payment={payment} />
        <div className="flex flex-wrap justify-center gap-2">
          <Link href={orderHref} className={primaryLink}>
            {t.payment.viewOrder}
          </Link>
          <Link href="/account/orders" className={outlineLink}>
            {t.payment.myOrders}
          </Link>
        </div>
      </ResultCard>
    );
  }

  if (outcome === 'failure') {
    const message =
      payment.errorMessage ??
      (reason ? t.payment.reasons[reason] : undefined) ??
      t.payment.reasons[payment.status] ??
      null;
    return (
      <ResultCard outcome="failure" title={t.payment.failureTitle}>
        {message ? <Alert tone="error">{message}</Alert> : null}
        <p className="text-sm text-ink-muted">{t.payment.failureBody}</p>
        <PaymentSummary payment={payment} />
        <div className="flex flex-wrap justify-center gap-2">
          <PayOrderButton
            orderId={payment.orderId}
            provider={payment.provider}
            label={t.payment.retry}
          />
          <Link href={orderHref} className={outlineLink}>
            {t.payment.viewOrder}
          </Link>
        </div>
      </ResultCard>
    );
  }

  return (
    <ResultCard outcome="pending" title={t.payment.pendingTitle}>
      <PaymentSummary payment={payment} />
      <PaymentPending paymentId={payment.id} />
      <div className="flex flex-wrap justify-center gap-2">
        <Link href={orderHref} className={outlineLink}>
          {t.payment.viewOrder}
        </Link>
      </div>
    </ResultCard>
  );
}

function ReasonLine({ reason }: { reason: string }) {
  return (
    <p className="text-sm">
      <span className="text-ink-muted">{t.payment.reason}: </span>
      {t.payment.reasons[reason] ?? reason}
    </p>
  );
}

const outcomeStyles: Record<PaymentOutcome, { ring: string; glyph: string }> = {
  success: { ring: 'bg-green-50 text-green-700', glyph: '✓' },
  failure: { ring: 'bg-red-50 text-accent-600', glyph: '✕' },
  pending: { ring: 'bg-amber-50 text-amber-700', glyph: '…' },
};

function ResultCard({
  outcome,
  title,
  children,
}: {
  outcome: PaymentOutcome;
  title: string;
  children: ReactNode;
}) {
  const style = outcomeStyles[outcome];
  return (
    <Card className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 text-center">
      <span
        aria-hidden="true"
        className={cn(
          'grid size-16 place-items-center rounded-full text-3xl font-bold',
          style.ring,
        )}
      >
        {style.glyph}
      </span>
      <h1 className="text-xl font-bold">{title}</h1>
      <div className="flex w-full flex-col gap-4 text-start">{children}</div>
    </Card>
  );
}
