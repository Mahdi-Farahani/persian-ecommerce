'use client';

import { toPersianDigits } from '@pe/shared';
import { t } from '@/i18n';

interface QuantityStepperProps {
  value: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}

export function QuantityStepper({ value, max, disabled, onChange }: QuantityStepperProps) {
  const buttonClass =
    'grid size-9 place-items-center text-lg leading-none transition hover:bg-surface-muted disabled:opacity-40';
  return (
    <div
      className="inline-flex items-center rounded-lg border border-border bg-surface"
      role="group"
      aria-label={t.cart.quantity}
    >
      <button
        type="button"
        className={buttonClass}
        aria-label={t.cart.increase}
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
      <span className="min-w-8 text-center text-sm font-bold tabular-nums" aria-live="polite">
        {toPersianDigits(value)}
      </span>
      <button
        type="button"
        className={buttonClass}
        aria-label={value <= 1 ? t.cart.remove : t.cart.decrease}
        disabled={disabled}
        onClick={() => onChange(value - 1)}
      >
        {value <= 1 ? <TrashIcon /> : '−'}
      </button>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
