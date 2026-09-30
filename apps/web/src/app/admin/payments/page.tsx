import {
  PAYMENT_PROVIDER_LABELS,
  PAYMENT_STATUS_LABELS,
  PaymentProviders,
  PaymentStatuses,
  formatJalaliDateTime,
  formatPersianNumber,
  toPersianDigits,
  toToman,
} from '@pe/shared';
import Link from 'next/link';
import { DataTable, Td } from '@/components/admin/data-table';
import { PageHeader } from '@/components/admin/page-header';
import { PaymentStatusBadge } from '@/components/orders/order-status-badge';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/form-field';
import { Pagination } from '@/components/ui/pagination';
import { adminFa } from '@/i18n/admin-fa';
import { adminListPayments, pageHref, parsePage } from '@/lib/admin/server';
import { requireUser } from '@/lib/auth/server';

export const metadata = { title: adminFa.payments.title };

const copy = adminFa.payments;
const PAGE_SIZE = 20;

const columns = [
  { key: 'order', label: copy.table.order },
  { key: 'customer', label: copy.table.customer },
  { key: 'provider', label: copy.table.provider },
  { key: 'amount', label: copy.table.amount },
  { key: 'status', label: copy.table.status },
  { key: 'refId', label: copy.table.refId },
  { key: 'date', label: copy.table.date },
] as const;

const statusOptions = PaymentStatuses.map((status) => ({
  value: status,
  label: PAYMENT_STATUS_LABELS[status],
}));
const providerOptions = PaymentProviders.map((provider) => ({
  value: provider,
  label: PAYMENT_PROVIDER_LABELS[provider],
}));

function pick(value: string | undefined, allowed: readonly string[]): string {
  return value && allowed.includes(value) ? value : '';
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    provider?: string;
    orderId?: string;
  }>;
}) {
  await requireUser('/admin/payments');
  const params = await searchParams;
  const page = parsePage(params.page);
  const search = params.search?.trim() ?? '';
  const status = pick(params.status, PaymentStatuses);
  const provider = pick(params.provider, PaymentProviders);
  const orderId = params.orderId?.trim() ?? '';
  const hasFilters = Boolean(search || status || provider || orderId);

  const result = await adminListPayments({
    page,
    limit: PAGE_SIZE,
    search,
    status,
    provider,
    orderId,
  });

  return (
    <div>
      <PageHeader
        title={copy.title}
        description={adminFa.common.total(formatPersianNumber(result.pagination.total))}
      />
      <form method="get" action="/admin/payments" className="mb-4 flex flex-wrap items-end gap-3">
        <TextField
          label={adminFa.common.search}
          name="search"
          defaultValue={search}
          placeholder={copy.searchPlaceholder}
          containerClassName="min-w-56 flex-1"
        />
        <SelectField
          label={adminFa.common.status}
          name="status"
          defaultValue={status}
          placeholder={copy.allStatuses}
          options={statusOptions}
        />
        <SelectField
          label={copy.provider}
          name="provider"
          defaultValue={provider}
          placeholder={copy.allProviders}
          options={providerOptions}
        />
        {orderId ? <input type="hidden" name="orderId" value={orderId} /> : null}
        <Button type="submit" variant="secondary">
          {adminFa.common.filter}
        </Button>
        {hasFilters ? (
          <Link
            href="/admin/payments"
            className="inline-flex h-11 items-center px-2 text-sm text-ink-muted hover:text-brand-700"
          >
            {adminFa.common.clearFilters}
          </Link>
        ) : null}
      </form>
      <DataTable
        columns={columns}
        empty={result.items.length === 0}
        emptyMessage={copy.empty}
        caption={copy.title}
      >
        {result.items.map((payment) => (
          <tr key={payment.id} className="hover:bg-surface-muted/60">
            <Td>
              <Link
                href={`/admin/payments/${payment.id}`}
                className="font-medium tabular-nums hover:text-brand-700"
                dir="ltr"
              >
                {toPersianDigits(payment.orderNumber)}
              </Link>
              <span className="block text-xs text-ink-muted">
                #{formatPersianNumber(payment.attemptNumber)}
              </span>
            </Td>
            <Td>
              <div className="flex flex-col">
                <span>{payment.customer.name || adminFa.orders.noName}</span>
                <span className="text-xs text-ink-muted" dir="ltr">
                  {payment.customer.email ??
                    (payment.customer.phone ? toPersianDigits(payment.customer.phone) : '')}
                </span>
              </div>
            </Td>
            <Td>
              {PAYMENT_PROVIDER_LABELS[payment.provider]}
              {payment.environment === 'SANDBOX' ? (
                <span className="ms-1 text-xs text-amber-700">(sandbox)</span>
              ) : null}
            </Td>
            <Td className="tabular-nums">{formatPersianNumber(toToman(payment.amount))}</Td>
            <Td>
              <PaymentStatusBadge status={payment.status} />
            </Td>
            <Td className="text-xs" dir="ltr">
              {payment.providerTransactionId ?? adminFa.common.none}
            </Td>
            <Td className="text-xs text-ink-muted">{formatJalaliDateTime(payment.createdAt)}</Td>
          </tr>
        ))}
      </DataTable>
      <div className="mt-4">
        <Pagination
          pagination={result.pagination}
          hrefFor={pageHref('/admin/payments', { search, status, provider, orderId })}
        />
      </div>
    </div>
  );
}
