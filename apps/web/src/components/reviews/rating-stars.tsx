import { REVIEW_MAX_RATING, toPersianDigits } from '@pe/shared';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

interface RatingStarsProps {
  /** Rating between 0 and `REVIEW_MAX_RATING`; fractions render partially filled stars. */
  value: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 'size-3.5', md: 'size-5', lg: 'size-6' } as const;

/** Read-only star rating with an accessible Persian label. */
export function RatingStars({ value, size = 'sm', className }: RatingStarsProps) {
  const clamped = Math.max(0, Math.min(REVIEW_MAX_RATING, value));
  const label = t.reviews.ratingLabel(
    toPersianDigits(Number.isInteger(clamped) ? clamped : clamped.toFixed(1)),
    toPersianDigits(REVIEW_MAX_RATING),
  );
  return (
    <span role="img" aria-label={label} className={cn('inline-flex gap-0.5', className)} dir="ltr">
      {Array.from({ length: REVIEW_MAX_RATING }, (_, index) => {
        const fill = Math.max(0, Math.min(1, clamped - index));
        return <Star key={index} fill={fill} className={sizes[size]} />;
      })}
    </span>
  );
}

function Star({ fill, className }: { fill: number; className: string }) {
  return (
    <span className={cn('relative inline-block shrink-0', className)}>
      <StarShape className="absolute inset-0 fill-border" />
      <span
        aria-hidden="true"
        className="absolute inset-y-0 start-0 overflow-hidden"
        style={{ width: `${fill * 100}%` }}
      >
        <StarShape className={cn('fill-amber-400', className)} />
      </span>
    </span>
  );
}

export function StarShape({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={cn('block size-full', className)}>
      <path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 14.9l-5.2 2.8 1-5.9L1.5 7.7l5.9-.8z" />
    </svg>
  );
}
