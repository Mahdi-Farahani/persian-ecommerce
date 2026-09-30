'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { IRAN_PROVINCES } from '@pe/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SelectField, TextAreaField, TextField } from '@/components/ui/form-field';
import { t } from '@/i18n';
import { browserApi } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/error-message';
import type { Address } from '@/lib/types/address';
import { addressSchema, type AddressFormValues } from '@/lib/validation/schemas';

const provinceOptions = IRAN_PROVINCES.map((p) => ({ value: p, label: p }));

interface AddressFormProps {
  address?: Address;
  onSaved: (address: Address) => void;
  onCancel: () => void;
}

export function AddressForm({ address, onSaved, onCancel }: AddressFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AddressFormValues>({
    resolver: yupResolver(addressSchema),
    defaultValues: address
      ? {
          title: address.title,
          recipientName: address.recipientName,
          recipientPhone: address.recipientPhone,
          province: address.province,
          city: address.city,
          addressLine: address.addressLine,
          postalCode: address.postalCode,
          isDefault: address.isDefault,
        }
      : { isDefault: false, province: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const saved = address
        ? await browserApi.patch<Address>(`/users/me/addresses/${address.id}`, values)
        : await browserApi.post<Address>('/users/me/addresses', values);
      onSaved(saved);
    } catch (error) {
      setServerError(errorMessage(error));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {serverError ? <Alert tone="error">{serverError}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t.account.address.title}
          error={errors.title?.message}
          {...register('title')}
        />
        <TextField
          label={t.account.address.recipientName}
          autoComplete="name"
          error={errors.recipientName?.message}
          {...register('recipientName')}
        />
        <TextField
          label={t.account.address.recipientPhone}
          type="tel"
          inputMode="tel"
          dir="ltr"
          className="text-left"
          error={errors.recipientPhone?.message}
          {...register('recipientPhone')}
        />
        <TextField
          label={t.account.address.postalCode}
          inputMode="numeric"
          dir="ltr"
          className="text-left"
          error={errors.postalCode?.message}
          {...register('postalCode')}
        />
        <SelectField
          label={t.account.address.province}
          placeholder={t.account.address.selectProvince}
          options={provinceOptions}
          error={errors.province?.message}
          {...register('province')}
        />
        <TextField
          label={t.account.address.city}
          error={errors.city?.message}
          {...register('city')}
        />
      </div>
      <TextAreaField
        label={t.account.address.addressLine}
        error={errors.addressLine?.message}
        {...register('addressLine')}
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-brand-600" {...register('isDefault')} />
        {t.account.setDefault}
      </label>
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
