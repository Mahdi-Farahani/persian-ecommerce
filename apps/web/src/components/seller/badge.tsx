import type { ReactNode } from 'react';
import type { SellerTone } from '@/lib/seller/status';
import { cn } from '@/lib/utils';

const tones: Record<SellerTone, string> = {
  neutral: 'bg-surface-muted text-ink-muted',
  success: 'bg-green-50 text-green-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-accent-600',
  info: 'bg-brand-50 text-brand-700',
};

/** Compact status pill used across the seller portal. */
export function SellerBadge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: SellerTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
