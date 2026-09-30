import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  containerClassName?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, containerClassName, ...rest },
  ref,
) {
  return (
    <label className={cn('inline-flex items-center gap-2 text-sm', containerClassName)}>
      <input
        ref={ref}
        type="checkbox"
        className={cn('size-4 accent-brand-600', className)}
        {...rest}
      />
      {label}
    </label>
  );
});
