'use client';

import { useFieldArray, useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/form-field';
import { adminFa } from '@/i18n/admin-fa';
import type { ProductFormValues } from '@/lib/admin/schemas';

const copy = adminFa.products.specifications;

/** Editable list of technical specification rows (group / name / value). */
export function SpecificationsEditor({ disabled }: { disabled?: boolean }) {
  const {
    register,
    formState: { errors },
  } = useFormContext<ProductFormValues>();
  const { fields, append, remove } = useFieldArray<ProductFormValues, 'specifications'>({
    name: 'specifications',
  });

  return (
    <div className="flex flex-col gap-3">
      {fields.length === 0 ? <p className="text-sm text-ink-muted">{copy.empty}</p> : null}
      {fields.map((field, index) => {
        const rowErrors = errors.specifications?.[index];
        return (
          <div key={field.id} className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_2fr_auto]">
            <TextField
              label={copy.group}
              optional
              disabled={disabled}
              error={rowErrors?.group?.message}
              {...register(`specifications.${index}.group`)}
            />
            <TextField
              label={copy.name}
              disabled={disabled}
              error={rowErrors?.name?.message}
              {...register(`specifications.${index}.name`)}
            />
            <TextField
              label={copy.value}
              disabled={disabled}
              error={rowErrors?.value?.message}
              {...register(`specifications.${index}.value`)}
            />
            <Button
              type="button"
              variant="ghost"
              className="mt-7 text-accent-600"
              disabled={disabled}
              onClick={() => remove(index)}
            >
              {copy.remove}
            </Button>
          </div>
        );
      })}
      {disabled ? null : (
        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => append({ group: undefined, name: '', value: '' })}
          >
            {copy.add}
          </Button>
        </div>
      )}
    </div>
  );
}
