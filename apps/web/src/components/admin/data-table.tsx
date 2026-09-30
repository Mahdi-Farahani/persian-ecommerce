import type { ReactNode, TdHTMLAttributes } from 'react';
import { adminFa } from '@/i18n/admin-fa';
import { cn } from '@/lib/utils';

interface DataTableProps {
  /** Column headers in visual order (first column is at the start edge in RTL). */
  columns: ReadonlyArray<{ key: string; label: string; className?: string; srOnly?: boolean }>;
  children: ReactNode;
  empty?: boolean;
  emptyMessage?: string;
  caption?: string;
}

/** Horizontally scrollable table with the admin panel's standard styling. */
export function DataTable({ columns, children, empty, emptyMessage, caption }: DataTableProps) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full min-w-[640px] text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="bg-surface-muted text-xs text-ink-muted">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn('px-3 py-2 text-start font-medium', column.className)}
              >
                {column.srOnly ? <span className="sr-only">{column.label}</span> : column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {empty ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-ink-muted">
                {emptyMessage ?? adminFa.common.empty}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Td({ children, className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('px-3 py-2 align-middle', className)} {...rest}>
      {children}
    </td>
  );
}
