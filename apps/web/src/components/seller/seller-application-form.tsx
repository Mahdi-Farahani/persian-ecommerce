'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { IRAN_PROVINCES, type SellerProfileView } from '@pe/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SelectField, TextAreaField, TextField } from '@/components/ui/form-field';
import { t } from '@/i18n';
import { browserApi } from '@/lib/api/client';
import { sellerErrorMessage } from '@/lib/seller/errors';
import { toSellerApplicationPayload } from '@/lib/seller/schemas';
import {
  SELLER_DESCRIPTION_MAX,
  sellerApplicationSchema,
  type SellerApplicationFormValues,
} from '@/lib/validation/schemas';

const copy = t.seller.apply;

const provinceOptions = IRAN_PROVINCES.map((name) => ({ value: name, label: name }));

export interface SellerApplicationFormProps {
  /** Existing profile switches the form into edit mode (`PATCH /seller/profile`). */
  profile?: SellerProfileView | null;
  onSuccess?: (profile: SellerProfileView) => void | Promise<void>;
  onCancel?: () => void;
  /** Re-renders the surrounding server page after success (default: true). */
  refresh?: boolean;
}

function defaultsFrom(profile: SellerProfileView | null | undefined): SellerApplicationFormValues {
  return {
    storeName: profile?.storeName ?? '',
    description: profile?.description ?? '',
    contactPhone: profile?.contactPhone ?? '',
    contactEmail: profile?.contactEmail ?? '',
    legalName: profile?.legalName ?? '',
    nationalId: profile?.nationalId ?? '',
    // The stored IBAN is only ever shown masked; blank keeps it on edit.
    iban: '',
    province: profile?.province ?? '',
    city: profile?.city ?? '',
    addressLine: profile?.addressLine ?? '',
  };
}

/** Seller application (`POST /seller/apply`) and profile editor (`PATCH /seller/profile`). */
export function SellerApplicationForm({
  profile,
  onSuccess,
  onCancel,
  refresh = true,
}: SellerApplicationFormProps) {
  const router = useRouter();
  const mode = profile ? 'edit' : 'apply';
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SellerApplicationFormValues>({
    resolver: yupResolver(sellerApplicationSchema),
    defaultValues: defaultsFrom(profile),
  });

  const onSubmit = handleSubmit(async (values) => {
    setStatus(null);
    const payload = toSellerApplicationPayload(values, mode);
    try {
      const saved =
        mode === 'edit'
          ? await browserApi.patch<SellerProfileView>('/seller/profile', payload)
          : await browserApi.post<SellerProfileView>('/seller/apply', payload);
      setStatus({ tone: 'success', message: mode === 'edit' ? copy.saved : copy.success });
      reset(defaultsFrom(saved));
      // Header links depend on the SELLER role, which the server resolves.
      if (refresh) router.refresh();
      await onSuccess?.(saved);
    } catch (error) {
      setStatus({ tone: 'error', message: sellerErrorMessage(error) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {status ? <Alert tone={status.tone}>{status.message}</Alert> : null}

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 text-base font-bold">{copy.sections.store}</legend>
        <TextField
          label={copy.fields.storeName}
          autoComplete="organization"
          error={errors.storeName?.message}
          {...register('storeName')}
        />
        <TextAreaField
          label={copy.fields.description}
          optional
          maxLength={SELLER_DESCRIPTION_MAX}
          error={errors.description?.message}
          {...register('description')}
        />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-base font-bold">{copy.sections.contact}</legend>
        <TextField
          label={copy.fields.contactPhone}
          inputMode="tel"
          dir="ltr"
          className="text-left"
          autoComplete="tel"
          error={errors.contactPhone?.message}
          {...register('contactPhone')}
        />
        <TextField
          label={copy.fields.contactEmail}
          optional
          type="email"
          dir="ltr"
          className="text-left"
          autoComplete="email"
          error={errors.contactEmail?.message}
          {...register('contactEmail')}
        />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-base font-bold">{copy.sections.legal}</legend>
        <TextField
          label={copy.fields.legalName}
          optional
          error={errors.legalName?.message}
          {...register('legalName')}
        />
        <TextField
          label={copy.fields.nationalId}
          optional
          inputMode="numeric"
          dir="ltr"
          className="text-left"
          hint={copy.hints.nationalId}
          error={errors.nationalId?.message}
          {...register('nationalId')}
        />
        <TextField
          label={copy.fields.iban}
          optional
          dir="ltr"
          className="text-left font-mono"
          hint={profile?.ibanMasked ? copy.hints.ibanKeep(profile.ibanMasked) : copy.hints.iban}
          error={errors.iban?.message}
          containerClassName="sm:col-span-2"
          {...register('iban')}
        />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-base font-bold">{copy.sections.address}</legend>
        <SelectField
          label={copy.fields.province}
          optional
          placeholder={copy.selectProvince}
          options={provinceOptions}
          error={errors.province?.message}
          {...register('province')}
        />
        <TextField
          label={copy.fields.city}
          optional
          autoComplete="address-level2"
          error={errors.city?.message}
          {...register('city')}
        />
        <div className="sm:col-span-2">
          <TextAreaField
            label={copy.fields.addressLine}
            optional
            autoComplete="street-address"
            error={errors.addressLine?.message}
            {...register('addressLine')}
          />
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={isSubmitting}>
          {mode === 'edit'
            ? isSubmitting
              ? t.common.saving
              : t.common.save
            : isSubmitting
              ? copy.submitting
              : copy.submit}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            {t.common.cancel}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
