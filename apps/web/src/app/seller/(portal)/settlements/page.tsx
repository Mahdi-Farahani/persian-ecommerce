import {
  SETTLEMENT_STATUS_LABELS,
  formatJalaliDate,
  formatPersianNumber,
  formatToman,
  toPersianDigits,
} from '@pe/shared';
import type { Metadata } from 'next';
import { SellerBadge } from '@/components/seller/badge';
import { SellerTable, Td } from '@/components/seller/table';
import { Pagination } from '@/components/ui/pagination';
import { t } from '@/i18n';
import { pageHref, parsePage } from '@/lib/admin/server';
import { getApprovedSeller, listSellerSettlements } from '@/lib/seller/server';
import { settlementStatusTone } from '@/lib/seller/status';

export const metadata: Metadata = { title: t.seller.settlements.title, robots: { index: false } };

const copy = t.seller.settlements;
const PAGE_SIZE = 20;

const columns = [
  { key: 'period', label: copy.columns.period },
  { key: 'gross', label: copy.columns.gross },
  { key: 'commission', label: copy.columns.commission },
  { key: 'net', label: copy.columns.net },
  { key: 'items', label: copy.columns.items },
  { key: 'status', label: copy.columns.status },
  { key: 'paidAt', label: copy.columns.paidAt },
] as const;

export default async function SellerSettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const seller = await getApprovedSeller();
  if (!seller) return null;
  const params = await searchParams;
  const page = parsePage(params.page);
  const result = await listSellerSettlements({ page, limit: PAGE_SIZE });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">{copy.title}</h1>
        <p className="text-sm text-ink-muted">{copy.hint}</p>
      </div>
      <SellerTable
        columns={columns}
        empty={result.items.length === 0}
        emptyMessage={copy.empty}
        caption={copy.title}
      >
        {result.items.map((settlement) => (
          <tr key={settlement.id} className="hover:bg-surface-muted/60">
            <Td>
              {settlement.periodStart && settlement.periodEnd ? (
                <span>
                  {formatJalaliDate(settlement.periodStart)} –{' '}
                  {formatJalaliDate(settlement.periodEnd)}
                </span>
              ) : (
                <span className="text-ink-muted">
                  {copy.createdAt}: {formatJalaliDate(settlement.createdAt)}
                </span>
              )}
              {settlement.note ? (
                <p className="mt-1 text-xs text-ink-muted">{settlement.note}</p>
              ) : null}
            </Td>
            <Td className="tabular-nums">{formatToman(settlement.grossAmount)}</Td>
            <Td className="tabular-nums text-ink-muted">
              {formatToman(settlement.commissionAmount)}
            </Td>
            <Td className="font-bold tabular-nums">{formatToman(settlement.netAmount)}</Td>
            <Td className="tabular-nums">
              {copy.itemsCount(formatPersianNumber(settlement.itemCount))}
            </Td>
            <Td>
              <SellerBadge tone={settlementStatusTone(settlement.status)}>
                {SETTLEMENT_STATUS_LABELS[settlement.status]}
              </SellerBadge>
            </Td>
            <Td className="text-xs text-ink-muted">
              {settlement.paidAt ? formatJalaliDate(settlement.paidAt) : '—'}
              {settlement.paymentReference ? (
                <p dir="ltr" className="mt-1 text-start font-mono">
                  {toPersianDigits(settlement.paymentReference)}
                </p>
              ) : null}
            </Td>
          </tr>
        ))}
      </SellerTable>
      <Pagination pagination={result.pagination} hrefFor={pageHref('/seller/settlements', {})} />
    </div>
  );
}
