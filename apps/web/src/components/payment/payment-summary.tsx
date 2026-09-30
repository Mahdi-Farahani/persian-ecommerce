import {
  PAYMENT_PROVIDER_LABELS,
  PAYMENT_STATUS_LABELS,
  formatToman,
  toPersianDigits,
  type PaymentView,
} from '@pe/shared';
import { t } from '@/i18n';

/** Key facts about a payment, shown on every result page. */
export function PaymentSummary({ payment }: { payment: PaymentView }) {
  const rows: Array<{ label: string; value: string; ltr?: boolean }> = [
    { label: t.payment.orderNumber, value: toPersianDigits(payment.orderNumber) },
    { label: t.payment.amount, value: formatToman(payment.amount) },
    { label: t.payment.provider, value: PAYMENT_PROVIDER_LABELS[payment.provider] },
    { label: t.payment.status, value: PAYMENT_STATUS_LABELS[payment.status] },
  ];
  if (payment.providerTransactionId) {
    rows.push({
      label: t.payment.refId,
      value: toPersianDigits(payment.providerTransactionId),
      ltr: true,
    });
  }
  if (payment.cardPanMask) {
    rows.push({ label: t.payment.card, value: toPersianDigits(payment.cardPanMask), ltr: true });
  }
  return (
    <dl className="grid gap-3 rounded-lg border border-border p-4 text-sm sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="text-xs text-ink-muted">{row.label}</dt>
          <dd className="font-medium tabular-nums" dir={row.ltr ? 'ltr' : undefined}>
            <span className={row.ltr ? 'inline-block text-start' : undefined}>{row.value}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
