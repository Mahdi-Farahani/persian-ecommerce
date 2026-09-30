'use client';

import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/form-field';
import { adminFa } from '@/i18n/admin-fa';
import type { AttributeFormValues } from '@/lib/admin/schemas';

const copy = adminFa.attributes;

/** Editable rows for the allowed values of a SELECT attribute. */
export function AttributeValuesEditor({ disabled }: { disabled?: boolean }) {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<AttributeFormValues>();
  const { fields, append, remove } = useFieldArray<AttributeFormValues, 'values'>({
    name: 'values',
  });
  const values = useWatch({ control, name: 'values' });
  // Array-level errors live under `root` once rows exist (field-array convention).
  const listError =
    errors.values?.root?.message ??
    (typeof errors.values?.message === 'string' ? errors.values.message : undefined);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-muted">{copy.valuesHint}</p>
      {listError ? (
        <p role="alert" className="text-xs text-accent-600">
          {listError}
        </p>
      ) : null}
      {fields.map((field, index) => {
        const rowErrors = errors.values?.[index];
        const colorHex = values[index]?.colorHex ?? '';
        return (
          <div
            key={field.id}
            className="grid items-start gap-3 sm:grid-cols-[2fr_1.5fr_1.5fr_1fr_auto]"
          >
            <TextField
              label={copy.value}
              disabled={disabled}
              error={rowErrors?.value?.message}
              {...register(`values.${index}.value`)}
            />
            <TextField
              label={copy.valueSlug}
              optional
              dir="ltr"
              className="text-left"
              disabled={disabled}
              error={rowErrors?.slug?.message}
              {...register(`values.${index}.slug`)}
            />
            <div className="flex items-end gap-2">
              <TextField
                label={copy.colorHex}
                optional
                dir="ltr"
                className="text-left"
                placeholder="#000000"
                disabled={disabled}
                error={rowErrors?.colorHex?.message}
                containerClassName="flex-1"
                {...register(`values.${index}.colorHex`)}
              />
              <input
                type="color"
                aria-label={copy.colorHex}
                value={/^#[0-9a-fA-F]{6}$/.test(colorHex) ? colorHex : '#000000'}
                disabled={disabled}
                onChange={(event) =>
                  setValue(`values.${index}.colorHex`, event.target.value, { shouldDirty: true })
                }
                className={
                  rowErrors?.colorHex
                    ? 'mb-6 size-11 shrink-0 cursor-pointer rounded-lg border border-border'
                    : 'size-11 shrink-0 cursor-pointer rounded-lg border border-border'
                }
              />
            </div>
            <TextField
              label={adminFa.common.sortOrder}
              inputMode="numeric"
              dir="ltr"
              className="text-left"
              disabled={disabled}
              error={rowErrors?.sortOrder?.message}
              {...register(`values.${index}.sortOrder`)}
            />
            <Button
              type="button"
              variant="ghost"
              className="mt-7 text-accent-600"
              disabled={disabled}
              onClick={() => remove(index)}
            >
              {copy.removeValue}
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
            onClick={() =>
              append({
                id: undefined,
                value: '',
                slug: undefined,
                colorHex: '',
                sortOrder: fields.length,
              })
            }
          >
            {copy.addValue}
          </Button>
        </div>
      )}
    </div>
  );
}
