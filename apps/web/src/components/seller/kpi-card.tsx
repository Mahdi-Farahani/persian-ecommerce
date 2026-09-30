import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Dashboard metric tile: a label, a headline value and an optional footnote. */
export function KpiCard({
  label,
  value,
  hint,
  children,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-card border border-border bg-surface p-4', className)}>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
