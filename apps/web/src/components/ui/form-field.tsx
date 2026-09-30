import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
} from 'react';
import { cn } from '@/lib/utils';

interface FieldWrapperProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}

const controlClass =
  'w-full rounded-lg border bg-surface px-3 text-sm outline-none transition placeholder:text-ink-muted/70 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-surface-muted aria-invalid:border-accent-500 aria-invalid:focus:ring-accent-500/20';

function FieldWrapper({
  id,
  label,
  error,
  hint,
  optional,
  children,
  className,
}: FieldWrapperProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional ? (
          <span className="ms-1 text-xs font-normal text-ink-muted">(اختیاری)</span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-accent-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  containerClassName?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, optional, id, className, containerClassName, ...rest },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldWrapper
      id={fieldId}
      label={label}
      error={error}
      hint={hint}
      optional={optional}
      className={containerClassName}
    >
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={cn(controlClass, 'h-11 border-border', className)}
        {...rest}
      />
    </FieldWrapper>
  );
});

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  function TextAreaField({ label, error, hint, optional, id, className, ...rest }, ref) {
    const generated = useId();
    const fieldId = id ?? generated;
    return (
      <FieldWrapper id={fieldId} label={label} error={error} hint={hint} optional={optional}>
        <textarea
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          className={cn(controlClass, 'min-h-24 border-border py-2', className)}
          {...rest}
        />
      </FieldWrapper>
    );
  },
);

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  placeholder?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, error, hint, optional, id, className, placeholder, options, ...rest },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldWrapper id={fieldId} label={label} error={error} hint={hint} optional={optional}>
      <select
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        className={cn(controlClass, 'h-11 border-border', className)}
        {...rest}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
});
