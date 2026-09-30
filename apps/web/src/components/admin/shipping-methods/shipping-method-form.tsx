'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Checkbox } from '@/components/admin/checkbox';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextAreaField, TextField } from '@/components/ui/form-field';
import { t } from '@/i18n';
import { adminFa } from '@/i18n/admin-fa';
import { adminErrorMessage } from '@/lib/admin/errors';
import { shippingMethodSchema, type ShippingMethodFormValues } from '@/lib/admin/schemas';
import {
  emptyShippingMethodFormValues,
  shippingMethodFormToInput,
  shippingMethodToFormValues,
} from '@/lib/admin/shipping-mappers';
import type { AdminShippingMethod } from '@/lib/admin/types';
import { browserApi } from '@/lib/api/client';

const copy = adminFa.shippingMethods;

interface ShippingMethodFormProps {
  method?: AdminShippingMethod;
  onSaved: (method: AdminShippingMethod) => void;
  onCancel: () => void;
}

export function ShippingMethodForm({ method, onSaved, onCancel }: ShippingMethodFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ShippingMethodFormValues>({
    resolver: yupResolver(shippingMethodSchema),
    defaultValues: method ? shippingMethodToFormValues(method) : emptyShippingMethodFormValues(),
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const body = shippingMethodFormToInput(values);
      const saved = method
        ? await browserApi.patch<AdminShippingMethod>(`/admin/shipping-methods/${method.id}`, body)
        : await browserApi.post<AdminShippingMethod>('/admin/shipping-methods', body);
      onSaved(saved);
    } catch (error) {
      setServerError(adminErrorMessage(error));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {serverError ? <Alert tone="error">{serverError}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TextField label={copy.fields.name} error={errors.name?.message} {...register('name')} />
        <TextField
          label={copy.fields.code}
          hint={copy.fields.codeHint}
          dir="ltr"
          className="text-left font-mono"
          autoComplete="off"
          error={errors.code?.message}
          {...register('code')}
        />
        <TextField
          label={copy.fields.sortOrder}
          inputMode="numeric"
          dir="ltr"
          className="text-left"
          error={errors.sortOrder?.message}
          {...register('sortOrder')}
        />
        <TextField
          label={copy.fields.baseFee}
          inputMode="numeric"
          dir="ltr"
          className="text-left"
          error={errors.baseFeeToman?.message}
          {...register('baseFeeToman')}
        />
        <TextField
          label={copy.fields.freeAboveAmount}
          optional
          hint={copy.fields.freeAboveHint}
          inputMode="numeric"
          dir="ltr"
          className="text-left"
          error={errors.freeAboveToman?.message}
          {...register('freeAboveToman')}
        />
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label={copy.fields.estimatedDaysMin}
            inputMode="numeric"
            dir="ltr"
            className="text-left"
            error={errors.estimatedDaysMin?.message}
            {...register('estimatedDaysMin')}
          />
          <TextField
            label={copy.fields.estimatedDaysMax}
            inputMode="numeric"
            dir="ltr"
            className="text-left"
            error={errors.estimatedDaysMax?.message}
            {...register('estimatedDaysMax')}
          />
        </div>
      </div>
      <TextAreaField
        label={copy.fields.description}
        optional
        className="min-h-20"
        error={errors.description?.message}
        {...register('description')}
      />
      <Checkbox label={copy.fields.isActive} {...register('isActive')} />
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
