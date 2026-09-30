import {
  PAYMENT_ENVIRONMENT_LABELS,
  PAYMENT_PROVIDER_LABELS,
  formatJalaliDateTime,
  formatPersianNumber,
  formatToman,
  hasPermission,
  toPersianDigits,
  toToman,
} from '@pe/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/admin/badge';
import { DataTable, Td } from '@/components/admin/data-table';
import { PageHeader } from '@/components/admin/page-header';
import { PaymentActions } from '@/components/admin/payments/payment-actions';
import { PaymentStatusBadge } from '@/components/orders/order-status-badge';
import { Card, CardTitle } from '@/components/ui/card';
import { adminFa } from '@/i18n/admin-fa';
import { AdminPermissions } from '@/lib/admin/navigation';
import { adminGetPayment } from '@/lib/admin/server';
import { requireUser } from '@/lib/auth/server';
import { orderStatusLabel } from '@/lib/orders/status';

export const metadata = { title: adminFa.payments.detailTitle };

const copy = adminFa.payments;

const ledgerColumns = [
  { key: 'type', label: copy.ledgerTable.type },
  { key: 'amount', label: copy.ledgerTable.amount },
  { key: 'result', label: copy.ledgerTable.result },
  { key: 'reference', label: copy.ledgerTable.reference },
  { key: 'errorCode', label: copy.ledgerTable.errorCode },
  { key: 'date', label: copy.ledgerTable.date },
] as const;

function formatPayload(payload: unknown): string | null {
  if (payload === null || payload === undefined) return null;
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

export default async function AdminPaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/admin/payments/${id}`);
  const payment = await adminGetPayment(id);
  if (!payment) notFound();

  const canViewOrders = hasPermission(user, AdminPermissions.ordersView);
  const facts: Array<{ label: string; value: string; ltr?: boolean }> = [
    { label: copy.provider, value: PAYMENT_PROVIDER_LABELS[payment.provider] },
    { label: copy.environment, value: PAYMENT_ENVIRONMENT_LABELS[payment.environment] },
    { label: copy.attempt, value: formatPersianNumber(payment.attemptNumber) },
    { label: copy.amount, value: formatToman(payment.amount) },
    { label: adminFa.orders.customer, value: payment.customer.name || adminFa.orders.noName },
    { label: copy.orderStatus, value: orderStatusLabel(payment.orderStatus) },
    { label: copy.createdAt, value: formatJalaliDateTime(payment.createdAt) },
  ];
  if (payment.redirectedAt) {
    facts.push({ label: copy.redirectedAt, value: formatJalaliDateTime(payment.redirectedAt) });
  }
  if (payment.callbackAt) {
    facts.push({ label: copy.callbackAt, value: formatJalaliDateTime(payment.callbackAt) });
  }
  if (payment.verifiedAt) {
    facts.push({ label: copy.verifiedAt, value: formatJalaliDateTime(payment.verifiedAt) });
  }
  if (payment.providerAuthority) {
    facts.push({ label: copy.authority, value: payment.providerAuthority, ltr: true });
  }
  if (payment.providerTransactionId) {
    facts.push({ label: copy.refId, value: payment.providerTransactionId, ltr: true });
  }
  if (payment.cardPanMask) facts.push({ label: copy.card, value: payment.cardPanMask, ltr: true });
  if (payment.errorCode) facts.push({ label: copy.errorCode, value: payment.errorCode, ltr: true });
  if (payment.errorMessage) facts.push({ label: copy.errorMessage, value: payment.errorMessage });
  facts.push({ label: copy.requestId, value: payment.requestId, ltr: true });

  const callbackPayload = formatPayload(payment.callbackPayload);
  const verificationPayload = formatPayload(payment.verificationPayload);

  return (
    <div>
      <PageHeader
        title={`${copy.detailTitle} — ${toPersianDigits(payment.orderNumber)}`}
        description={formatJalaliDateTime(payment.updatedAt)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PaymentStatusBadge status={payment.status} />
            {canViewOrders ? (
              <Link
                href={`/admin/orders/${payment.orderId}`}
                className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-medium hover:border-brand-400 hover:text-brand-700"
              >
                {copy.viewOrder}
              </Link>
            ) : null}
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardTitle>{copy.ledger}</CardTitle>
            <DataTable
              columns={ledgerColumns}
              empty={payment.transactions.length === 0}
              emptyMessage={copy.ledgerEmpty}
              caption={copy.ledger}
            >
              {payment.transactions.map((tx) => (
                <tr key={tx.id}>
                  <Td>{copy.transactionTypes[tx.type] ?? tx.type}</Td>
                  <Td className="tabular-nums">{formatPersianNumber(toToman(tx.amount))}</Td>
                  <Td>
                    <Badge tone={tx.succeeded ? 'success' : 'danger'}>
                      {tx.succeeded ? copy.succeeded : copy.failed}
                    </Badge>
                  </Td>
                  <Td className="text-xs" dir="ltr">
                    {tx.providerReference ?? adminFa.common.none}
                  </Td>
                  <Td className="text-xs" dir="ltr">
                    {tx.errorCode ?? adminFa.common.none}
                  </Td>
                  <Td className="text-xs text-ink-muted">{formatJalaliDateTime(tx.createdAt)}</Td>
                </tr>
              ))}
            </DataTable>
          </Card>

          {callbackPayload || verificationPayload ? (
            <Card>
              <CardTitle>{copy.payloads}</CardTitle>
              <div className="grid gap-4 md:grid-cols-2">
                {callbackPayload ? (
                  <div>
                    <p className="mb-1 text-xs text-ink-muted">{copy.callbackPayload}</p>
                    <pre
                      dir="ltr"
                      className="max-h-80 overflow-auto rounded-lg bg-surface-muted p-3 text-xs"
                    >
                      {callbackPayload}
                    </pre>
                  </div>
                ) : null}
                {verificationPayload ? (
                  <div>
                    <p className="mb-1 text-xs text-ink-muted">{copy.verificationPayload}</p>
                    <pre
                      dir="ltr"
                      className="max-h-80 overflow-auto rounded-lg bg-surface-muted p-3 text-xs"
                    >
                      {verificationPayload}
                    </pre>
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardTitle>{adminFa.common.actions}</CardTitle>
            <PaymentActions
              key={payment.status}
              payment={payment}
              canReconcile={hasPermission(user, AdminPermissions.paymentReconcile)}
              canRefund={hasPermission(user, AdminPermissions.paymentRefund)}
            />
          </Card>
          <Card className="text-sm">
            <dl className="grid gap-3">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="text-xs text-ink-muted">{fact.label}</dt>
                  <dd className="font-medium break-all" dir={fact.ltr ? 'ltr' : undefined}>
                    <span className={fact.ltr ? 'inline-block text-start' : undefined}>
                      {fact.value}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </aside>
      </div>
    </div>
  );
}
