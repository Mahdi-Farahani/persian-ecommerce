import { formatPersianNumber } from '@pe/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface StatRow {
  label: string;
  value: number;
  href?: string;
  /** Draws attention to non-zero values that need action (e.g. pending reviews). */
  alert?: boolean;
}

interface StatListProps {
  title: string;
  rows: StatRow[];
  /** Optional link rendered under the list. */
  footer?: { href: string; label: string };
  className?: string;
  children?: ReactNode;
}

const rowClass = 'flex items-center justify-between py-2';

/** Card listing labelled counts; rows with an href link to the filtered page. */
export function StatList({ title, rows, footer, className, children }: StatListProps) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardTitle className="mb-3 text-base">{title}</CardTitle>
      <ul className="divide-y divide-border text-sm">
        {rows.map((row) => {
          const content = (
            <>
              <span className="text-ink-muted">{row.label}</span>
              <span
                className={cn(
                  'font-semibold tabular-nums',
                  row.alert && row.value > 0 && 'text-amber-700',
                )}
              >
                {formatPersianNumber(row.value)}
              </span>
            </>
          );
          return (
            <li key={row.label}>
              {row.href ? (
                <Link
                  href={row.href}
                  className={cn(
                    rowClass,
                    '-mx-2 rounded-md px-2 transition hover:bg-surface-muted',
                  )}
                >
                  {content}
                </Link>
              ) : (
                <div className={rowClass}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
      {children}
      {footer ? (
        <Link
          href={footer.href}
          className="mt-auto pt-3 text-xs font-medium text-brand-700 hover:underline"
        >
          {footer.label}
        </Link>
      ) : null}
    </Card>
  );
}
