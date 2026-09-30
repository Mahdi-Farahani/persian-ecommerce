import 'server-only';
import { paymentOutcomeOf, type PaymentOutcome } from '@pe/shared';
import type { Metadata } from 'next';
import { Container } from '@/components/layout/container';
import { PaymentResult } from '@/components/payment/payment-result';
import { t } from '@/i18n';
import { getCurrentUser, requireUser } from '@/lib/auth/server';
import { getMyPayment } from '@/lib/orders/server';

export interface PaymentResultSearchParams {
  paymentId?: string;
  reason?: string;
}

interface PaymentResultPageProps {
  /** Path of the page (login redirect target). */
  path: string;
  searchParams: Promise<PaymentResultSearchParams>;
}

const titles: Record<PaymentOutcome, string> = {
  success: t.payment.successTitle,
  failure: t.payment.failureTitle,
  pending: t.payment.pendingTitle,
};

/**
 * Title that follows the backend status rather than the route the gateway
 * chose; anonymous visitors get the route's own title.
 */
export async function paymentResultMetadata(
  fallback: PaymentOutcome,
  searchParams: Promise<PaymentResultSearchParams>,
): Promise<Metadata> {
  const { paymentId } = await searchParams;
  let outcome: PaymentOutcome = fallback;
  if (paymentId?.trim() && (await getCurrentUser())) {
    const payment = await getMyPayment(paymentId.trim());
    outcome = payment ? paymentOutcomeOf(payment.status) : 'failure';
  }
  return { title: titles[outcome], robots: { index: false, follow: false } };
}

/**
 * Shared server component for `/payment/success|failure|pending`: loads the
 * payment for the signed-in customer and renders it by backend status.
 */
export async function PaymentResultPage({ path, searchParams }: PaymentResultPageProps) {
  const params = await searchParams;
  const paymentId = params.paymentId?.trim();
  const query = new URLSearchParams();
  if (paymentId) query.set('paymentId', paymentId);
  if (params.reason) query.set('reason', params.reason);
  const qs = query.toString();
  await requireUser(qs ? `${path}?${qs}` : path);
  const payment = paymentId ? await getMyPayment(paymentId) : null;
  return (
    <Container className="py-10">
      <PaymentResult payment={payment} reason={params.reason?.trim() || undefined} />
    </Container>
  );
}
