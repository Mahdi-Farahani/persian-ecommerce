import {
  INVENTORY_TRANSACTION_LABELS,
  formatJalaliDateTime,
  formatPersianNumber,
  type InventoryTransactionView,
} from '@pe/shared';
import { DataTable, Td } from '@/components/admin/data-table';
import { adminFa } from '@/i18n/admin-fa';
import { cn } from '@/lib/utils';

const copy = adminFa.inventory;

const columns = [
  { key: 'type', label: copy.ledgerTable.type },
  { key: 'quantity', label: copy.ledgerTable.quantity },
  { key: 'stockAfter', label: copy.ledgerTable.stockAfter },
  { key: 'reservedAfter', label: copy.ledgerTable.reservedAfter },
  { key: 'reference', label: copy.ledgerTable.reference },
  { key: 'note', label: copy.ledgerTable.note },
  { key: 'date', label: copy.ledgerTable.date },
] as const;

/** Signed quantity with Persian digits, e.g. "+۵" / "−۳". */
export function formatSignedQuantity(quantity: number): string {
  const sign = quantity > 0 ? '+' : quantity < 0 ? '−' : '';
  return `${sign}${formatPersianNumber(Math.abs(quantity))}`;
}

export function InventoryLedger({ transactions }: { transactions: InventoryTransactionView[] }) {
  return (
    <DataTable
      columns={columns}
      empty={transactions.length === 0}
      emptyMessage={copy.ledgerEmpty}
      caption={copy.ledger}
    >
      {transactions.map((tx) => (
        <tr key={tx.id}>
          <Td>{INVENTORY_TRANSACTION_LABELS[tx.type] ?? tx.type}</Td>
          <Td
            className={cn(
              'font-bold tabular-nums',
              tx.quantity > 0 ? 'text-green-700' : tx.quantity < 0 ? 'text-accent-600' : undefined,
            )}
          >
            <span dir="ltr" className="inline-block">
              {formatSignedQuantity(tx.quantity)}
            </span>
          </Td>
          <Td className="tabular-nums">{formatPersianNumber(tx.stockAfter)}</Td>
          <Td className="tabular-nums">{formatPersianNumber(tx.reservedAfter)}</Td>
          <Td className="text-xs text-ink-muted">
            {tx.referenceType ? (
              <span dir="ltr" className="inline-block">
                {tx.referenceType}
                {tx.referenceId ? `: ${tx.referenceId}` : ''}
              </span>
            ) : (
              adminFa.common.none
            )}
          </Td>
          <Td className="max-w-xs text-xs text-ink-muted">{tx.note ?? adminFa.common.none}</Td>
          <Td className="text-xs text-ink-muted whitespace-nowrap">
            {formatJalaliDateTime(tx.createdAt)}
          </Td>
        </tr>
      ))}
    </DataTable>
  );
}
