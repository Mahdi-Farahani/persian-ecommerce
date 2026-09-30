'use client';

import type { AttributeSummary } from '@pe/shared';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/form-field';
import { adminFa } from '@/i18n/admin-fa';
import type { ProductFormValues } from '@/lib/admin/schemas';

interface AttributesEditorProps {
  attributes: AttributeSummary[];
  disabled?: boolean;
}

const copy = adminFa.products.attributes;

const booleanOptions = [
  { value: 'true', label: copy.trueLabel },
  { value: 'false', label: copy.falseLabel },
];

/** Rows of (attribute, value) for informational product attributes. */
export function AttributesEditor({ attributes, disabled }: AttributesEditorProps) {
  const {
    register,
    setValue,
    control,
    formState: { errors },
  } = useFormContext<ProductFormValues>();
  const { fields, append, remove } = useFieldArray<ProductFormValues, 'attributes'>({
    name: 'attributes',
  });
  const rows = useWatch({ control, name: 'attributes' });

  const available = (currentId: string) =>
    attributes
      .filter(
        (attribute) =>
          attribute.id === currentId || !rows.some((row) => row.attributeId === attribute.id),
      )
      .map((attribute) => ({ value: attribute.id, label: attribute.name }));

  return (
    <div className="flex flex-col gap-3">
      {fields.length === 0 ? <p className="text-sm text-ink-muted">{copy.empty}</p> : null}
      {fields.map((field, index) => {
        const attributeId = rows[index]?.attributeId ?? '';
        const definition = attributes.find((attribute) => attribute.id === attributeId);
        const rowErrors = errors.attributes?.[index];
        const valueName = `attributes.${index}.value` as const;
        return (
          <div key={field.id} className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <SelectField
              label={copy.attribute}
              placeholder={copy.selectAttribute}
              options={available(attributeId)}
              disabled={disabled}
              error={rowErrors?.attributeId?.message}
              {...register(`attributes.${index}.attributeId`, {
                onChange: () => setValue(valueName, ''),
              })}
            />
            {definition?.type === 'SELECT' ? (
              <SelectField
                label={copy.value}
                placeholder={copy.selectValue}
                options={definition.values.map((value) => ({
                  value: value.id,
                  label: value.value,
                }))}
                disabled={disabled}
                error={rowErrors?.value?.message}
                {...register(valueName)}
              />
            ) : definition?.type === 'BOOLEAN' ? (
              <SelectField
                label={copy.value}
                placeholder={copy.selectValue}
                options={booleanOptions}
                disabled={disabled}
                error={rowErrors?.value?.message}
                {...register(valueName)}
              />
            ) : (
              <TextField
                label={definition?.unit ? `${copy.value} (${definition.unit})` : copy.value}
                inputMode={definition?.type === 'NUMBER' ? 'decimal' : undefined}
                disabled={disabled}
                error={rowErrors?.value?.message}
                {...register(valueName)}
              />
            )}
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
            disabled={available('').length === 0}
            onClick={() => append({ attributeId: '', value: '' })}
          >
            {copy.add}
          </Button>
        </div>
      )}
    </div>
  );
}
