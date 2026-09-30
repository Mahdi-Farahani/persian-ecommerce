'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { VariantStatuses, type AttributeSummary } from '@pe/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Checkbox } from '@/components/admin/checkbox';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/form-field';
import { t } from '@/i18n';
import { adminFa } from '@/i18n/admin-fa';
import { adminErrorMessage } from '@/lib/admin/errors';
import { emptyVariantFormValues } from '@/lib/admin/product-mappers';
import { variantSchema, type VariantFormValues } from '@/lib/admin/schemas';

interface VariantFormProps {
  /** Attributes flagged as variant-defining (colour, size…). */
  variantAttributes: AttributeSummary[];
  initial?: VariantFormValues;
  /** Initial stock / threshold only make sense when the variant is created. */
  showStockFields: boolean;
  onSubmit: (values: VariantFormValues) => Promise<void>;
  onCancel: () => void;
}

const statusOptions = VariantStatuses.map((status) => ({
  value: status,
  label: adminFa.products.variants.statusLabels[status] ?? status,
}));

const copy = adminFa.products.variants;

export function VariantForm({
  variantAttributes,
  initial,
  showStockFields,
  onSubmit,
  onCancel,
}: VariantFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VariantFormValues>({
    resolver: yupResolver(variantSchema),
    defaultValues: initial ?? emptyVariantFormValues(),
  });

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      setServerError(adminErrorMessage(error));
    }
  });

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-4 rounded-lg border border-brand-200 bg-brand-50/40 p-4"
    >
      <h3 className="text-sm font-bold">{initial ? copy.edit : copy.add}</h3>
      {serverError ? <Alert tone="error">{serverError}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TextField
          label={copy.sku}
          dir="ltr"
          className="text-left"
          error={errors.sku?.message}
          {...register('sku')}
        />
        <TextField
          label={copy.barcode}
          optional
          dir="ltr"
          className="text-left"
          error={errors.barcode?.message}
          {...register('barcode')}
        />
        <TextField
          label={copy.title}
          optional
          error={errors.title?.message}
          {...register('title')}
        />
        <TextField
          label={copy.price}
          inputMode="numeric"
          dir="ltr"
          className="text-left"
          error={errors.priceToman?.message}
          {...register('priceToman')}
        />
        <TextField
          label={copy.compareAtPrice}
          optional
          inputMode="numeric"
          dir="ltr"
          className="text-left"
          error={errors.compareAtPriceToman?.message}
          {...register('compareAtPriceToman')}
        />
        <SelectField
          label={copy.status}
          options={statusOptions}
          error={errors.status?.message}
          {...register('status')}
        />
        <TextField
          label={copy.weightGrams}
          optional
          inputMode="numeric"
          dir="ltr"
          className="text-left"
          error={errors.weightGrams?.message}
          {...register('weightGrams')}
        />
        {showStockFields ? (
          <>
            <TextField
              label={copy.initialStock}
              optional
              inputMode="numeric"
              dir="ltr"
              className="text-left"
              error={errors.initialStock?.message}
              {...register('initialStock')}
            />
            <TextField
              label={copy.lowStockThreshold}
              optional
              inputMode="numeric"
              dir="ltr"
              className="text-left"
              error={errors.lowStockThreshold?.message}
              {...register('lowStockThreshold')}
            />
          </>
        ) : null}
      </div>
      {variantAttributes.length > 0 ? (
        <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <legend className="mb-2 text-sm font-medium">{copy.attributeValues}</legend>
          {variantAttributes.map((attribute) => (
            <SelectField
              key={attribute.id}
              label={attribute.name}
              placeholder={copy.noValue}
              options={attribute.values.map((value) => ({ value: value.id, label: value.value }))}
              {...register(`attributeValues.${attribute.id}`)}
            />
          ))}
        </fieldset>
      ) : null}
      <Checkbox label={copy.isDefault} {...register('isDefault')} />
      <div className="flex gap-2">
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? t.common.saving : t.common.save}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  );
}
