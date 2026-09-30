'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { AttributeTypes, type AttributeSummary } from '@pe/shared';
import { useState } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { Checkbox } from '@/components/admin/checkbox';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/form-field';
import { t } from '@/i18n';
import { adminFa } from '@/i18n/admin-fa';
import { adminErrorMessage } from '@/lib/admin/errors';
import { attributeSchema, type AttributeFormValues } from '@/lib/admin/schemas';
import type { AttributeInput } from '@/lib/admin/types';
import { browserApi } from '@/lib/api/client';
import { AttributeValuesEditor } from './attribute-values-editor';

interface AttributeFormProps {
  attribute?: AttributeSummary;
  onSaved: (attribute: AttributeSummary) => void;
  onCancel: () => void;
}

const copy = adminFa.attributes;

const typeOptions = AttributeTypes.map((type) => ({
  value: type,
  label: copy.types[type] ?? type,
}));

export function toAttributeInput(values: AttributeFormValues): AttributeInput {
  return {
    name: values.name,
    slug: values.slug || undefined,
    type: values.type,
    unit: values.unit ?? null,
    isVariant: values.isVariant,
    isFilterable: values.isFilterable,
    sortOrder: values.sortOrder,
    values:
      values.type === 'SELECT'
        ? values.values.map((value, index) => ({
            id: value.id || undefined,
            value: value.value,
            slug: value.slug || undefined,
            colorHex: value.colorHex || null,
            sortOrder: value.sortOrder ?? index,
          }))
        : undefined,
  };
}

export function AttributeForm({ attribute, onSaved, onCancel }: AttributeFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<AttributeFormValues>({
    resolver: yupResolver(attributeSchema),
    defaultValues: attribute
      ? {
          name: attribute.name,
          slug: attribute.slug,
          type: attribute.type,
          unit: attribute.unit ?? undefined,
          isVariant: attribute.isVariant,
          isFilterable: attribute.isFilterable,
          sortOrder: attribute.sortOrder,
          values: [...attribute.values]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((value) => ({
              id: value.id,
              value: value.value,
              slug: value.slug,
              colorHex: value.colorHex ?? '',
              sortOrder: value.sortOrder,
            })),
        }
      : { type: 'SELECT', isVariant: false, isFilterable: true, sortOrder: 0, values: [] },
  });
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = form;
  const type = useWatch({ control, name: 'type' });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const body = toAttributeInput(values);
      const saved = attribute
        ? await browserApi.patch<AttributeSummary>(`/admin/attributes/${attribute.id}`, body)
        : await browserApi.post<AttributeSummary>('/admin/attributes', body);
      onSaved(saved);
    } catch (error) {
      setServerError(adminErrorMessage(error));
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {serverError ? <Alert tone="error">{serverError}</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={adminFa.common.name}
            error={errors.name?.message}
            {...register('name')}
          />
          <TextField
            label={adminFa.common.slug}
            optional
            hint={adminFa.common.slugHint}
            dir="ltr"
            className="text-left"
            error={errors.slug?.message}
            {...register('slug')}
          />
          <SelectField
            label={copy.type}
            options={typeOptions}
            error={errors.type?.message}
            {...register('type')}
          />
          <TextField
            label={copy.unit}
            optional
            error={errors.unit?.message}
            {...register('unit')}
          />
          <TextField
            label={adminFa.common.sortOrder}
            inputMode="numeric"
            dir="ltr"
            className="text-left"
            error={errors.sortOrder?.message}
            {...register('sortOrder')}
          />
        </div>
        <div className="flex flex-wrap gap-6">
          <Checkbox label={copy.isVariant} {...register('isVariant')} />
          <Checkbox label={copy.isFilterable} {...register('isFilterable')} />
        </div>
        {type === 'SELECT' ? (
          <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-medium">{copy.values}</legend>
            <AttributeValuesEditor />
          </fieldset>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? t.common.saving : t.common.save}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t.common.cancel}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
