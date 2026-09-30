import { formatJalaliDateTime, formatPersianNumber, formatToman, hasPermission } from '@pe/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Forbidden } from '@/components/admin/forbidden';
import { PageHeader } from '@/components/admin/page-header';
import { SettlementActions } from '@/components/admin/sellers/settlement-actions';
import { SettlementStatusBadge } from '@/components/admin/sellers/status-badges';
import { Alert } from '@/components/ui/alert';
import { Card, CardTitle } from '@/components/ui/card';
import { adminFa } from '@/i18n/admin-fa';
import { AdminPermissions } from '@/lib/admin/navigation';
import { settlementPeriod } from '@/lib/admin/sellers';
import { adminGetSettlement } from '@/lib/admin/server';
import { requireUser } from '@/lib/auth/server';

export const metadata = { title: adminFa.settlements.detailTitle };

const copy = adminFa.settlements;

export default async function AdminSettlementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/admin/settlements/${id}`);
  if (!hasPermission(user, AdminPermissions.sellersView)) return <Forbidden />;
  const settlement = await adminGetSettlement(id);
  if (!settlement) notFound();
  const canManage = hasPermission(user, AdminPermissions.sellersManage);

  const amounts = [
    { label: copy.gross, value: formatToman(settlement.grossAmount) },
    { label: copy.commission, value: formatToman(settlement.commissionAmount) },
    { label: copy.net, value: formatToman(settlement.netAmount), hero: true },
    { label: copy.items, value: formatPersianNumber(settlement.itemCount) },
  ];

  const facts: Array<{ label: string; value: string; ltr?: boolean }> = [
    { label: copy.period, value: settlementPeriod(settlement.periodStart, settlement.periodEnd) },
    { label: copy.createdAt, value: formatJalaliDateTime(settlement.createdAt) },
  ];
  if (settlement.paidAt)
    facts.push({ label: copy.paidAt, value: formatJalaliDateTime(settlement.paidAt) });
  if (settlement.paymentReference) {
    facts.push({ label: copy.paymentReference, value: settlement.paymentReference, ltr: true });
  }
  if (settlement.note) facts.push({ label: copy.note, value: settlement.note });

  return (
    <div>
      <PageHeader
        title={`${copy.detailTitle} — ${settlement.seller.storeName}`}
        description={formatJalaliDateTime(settlement.createdAt)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SettlementStatusBadge status={settlement.status} />
            <Link
              href={`/admin/sellers/${settlement.seller.id}?tab=settlements`}
              className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-medium hover:border-brand-400 hover:text-brand-700"
            >
              {copy.viewSeller}
            </Link>
            <Link
              href="/admin/settlements"
              className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-medium hover:border-brand-400 hover:text-brand-700"
            >
              {copy.backToList}
            </Link>
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          <Card>
            <dl className="grid gap-4 sm:grid-cols-2">
              {amounts.map((amount) => (
                <div key={amount.label}>
                  <dt className="text-xs text-ink-muted">{amount.label}</dt>
                  <dd
                    className={
                      amount.hero
                        ? 'mt-1 text-2xl font-bold tabular-nums'
                        : 'mt-0.5 text-base font-semibold tabular-nums'
                    }
                  >
                    {amount.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card className="text-sm">
            <dl className="grid gap-3 sm:grid-cols-2">
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
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardTitle>{adminFa.common.actions}</CardTitle>
            {settlement.status !== 'PENDING' ? (
              <Alert tone="info">{copy.finalized}</Alert>
            ) : canManage ? (
              <SettlementActions key={settlement.status} settlement={settlement} />
            ) : (
              <Alert tone="warning">{copy.readOnly}</Alert>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
