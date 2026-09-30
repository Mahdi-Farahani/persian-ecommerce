'use client';

import { REVIEW_MAX_RATING, REVIEW_MIN_RATING, toPersianDigits } from '@pe/shared';
import { forwardRef, useId, type ChangeEventHandler, type FocusEventHandler } from 'react';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { StarShape } from './rating-stars';

export interface StarPickerProps {
  label: string;
  name: string;
  /** Currently selected rating (controls which stars appear filled). */
  value: number | undefined;
  error?: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  disabled?: boolean;
}

const RATINGS = Array.from(
  { length: REVIEW_MAX_RATING - REVIEW_MIN_RATING + 1 },
  (_, index) => REVIEW_MIN_RATING + index,
);

/**
 * Accessible star rating input: a group of visually hidden radio buttons so
 * keyboard users get native arrow-key navigation, with star glyphs as labels.
 * Compatible with react-hook-form's `register` (spread the result on it); the
 * radios are controlled by `value` because RHF compares a numeric default
 * against the string DOM value and would otherwise leave them unchecked.
 */
export const StarPicker = forwardRef<HTMLInputElement, StarPickerProps>(function StarPicker(
  { label, name, value, error, onChange, onBlur, disabled },
  ref,
) {
  const groupId = useId();
  const errorId = `${groupId}-error`;
  const selected = value ?? 0;
  return (
    <fieldset
      aria-describedby={error ? errorId : undefined}
      aria-invalid={error ? true : undefined}
      className="flex flex-col gap-1.5"
    >
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="flex items-center gap-1" dir="ltr">
        {RATINGS.map((rating) => {
          const filled = rating <= selected;
          return (
            <label key={rating} className="cursor-pointer">
              <input
                ref={ref}
                type="radio"
                name={name}
                value={rating}
                checked={selected === rating}
                onChange={onChange}
                onBlur={onBlur}
                disabled={disabled}
                aria-label={t.reviews.stars(toPersianDigits(rating))}
                className="peer sr-only"
              />
              <StarShape
                className={cn(
                  'size-8 transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500',
                  filled ? 'fill-amber-400' : 'fill-border hover:fill-amber-200',
                )}
              />
            </label>
          );
        })}
        {selected > 0 ? (
          <span className="ms-2 text-xs text-ink-muted" dir="rtl">
            {t.reviews.stars(toPersianDigits(selected))}
          </span>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-accent-600">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
});
