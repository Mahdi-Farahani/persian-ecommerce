import { formatPersianNumber, toPersianDigits, toToman } from '@pe/shared';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

interface PriceProps {
  /** Amount in IRR. */
  amount: number | null;
  /** Compare-at amount in IRR (rendered struck through when higher). */
  compareAt?: number | null;
  discountPercent?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 'text-sm', md: 'text-base', lg: 'text-2xl' } as const;

/** Displays an IRR amount as Toman with Persian digits and an optional discount. */
export function Price({
  amount,
  compareAt,
  discountPercent = 0,
  size = 'md',
  className,
}: PriceProps) {
  if (amount === null) {
    return (
      <span className={cn('text-ink-muted', sizes[size], className)}>{t.catalog.unavailable}</span>
    );
  }
  const showCompare = compareAt !== null && compareAt !== undefined && compareAt > amount;
  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5', className)}>
      <span className={cn('font-bold tabular-nums', sizes[size])}>
        {formatPersianNumber(toToman(amount))}
        <span className="ms-1 text-xs font-normal text-ink-muted">{t.common.toman}</span>
      </span>
      {showCompare ? (
        <span className="text-xs text-ink-muted line-through tabular-nums">
          {formatPersianNumber(toToman(compareAt))}
        </span>
      ) : null}
      {showCompare && discountPercent > 0 ? (
        <span className="rounded-full bg-accent-500 px-1.5 py-0.5 text-xs font-bold text-white">
          {toPersianDigits(discountPercent)}٪
        </span>
      ) : null}
    </span>
  );
}
