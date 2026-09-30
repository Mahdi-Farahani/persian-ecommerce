import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-ink-muted',
  success: 'bg-green-50 text-green-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-accent-600',
  info: 'bg-brand-50 text-brand-700',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
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

const productStatusTones: Record<string, Tone> = {
  DRAFT: 'neutral',
  PENDING_REVIEW: 'warning',
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  OUT_OF_STOCK: 'danger',
  ARCHIVED: 'neutral',
};

const userStatusTones: Record<string, Tone> = {
  ACTIVE: 'success',
  SUSPENDED: 'danger',
  PENDING_VERIFICATION: 'warning',
  DELETED: 'neutral',
};

export function productStatusTone(status: string): Tone {
  return productStatusTones[status] ?? 'neutral';
}

export function userStatusTone(status: string): Tone {
  return userStatusTones[status] ?? 'neutral';
}
