'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import type { BrandDetail } from '@pe/shared';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Checkbox } from '@/components/admin/checkbox';
import { ImageUploadField } from '@/components/admin/image-upload-field';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextAreaField, TextField } from '@/components/ui/form-field';
import { t } from '@/i18n';
import { adminFa } from '@/i18n/admin-fa';
import { adminErrorMessage } from '@/lib/admin/errors';
import { brandSchema, type BrandFormValues } from '@/lib/admin/schemas';
import type { BrandInput } from '@/lib/admin/types';
import { browserApi } from '@/lib/api/client';

interface BrandFormProps {
  brand?: BrandDetail;
  onSaved: (brand: BrandDetail) => void;
  onCancel: () => void;
}

const copy = adminFa.brands;

function toInput(values: BrandFormValues): BrandInput {
  return {
    name: values.name,
    nameEn: values.nameEn ?? null,
    slug: values.slug || undefined,
    description: values.description ?? null,
    logoUrl: values.logoUrl || null,
    isActive: values.isActive,
    sortOrder: values.sortOrder,
    seoTitle: values.seoTitle ?? null,
    seoDescription: values.seoDescription ?? null,
  };
}

export function BrandForm({ brand, onSaved, onCancel }: BrandFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<BrandFormValues>({
    resolver: yupResolver(brandSchema),
    defaultValues: brand
      ? {
          name: brand.name,
          nameEn: brand.nameEn ?? undefined,
          slug: brand.slug,
          description: brand.description ?? undefined,
          logoUrl: brand.logoUrl ?? '',
          isActive: brand.isActive,
          sortOrder: brand.sortOrder,
          seoTitle: brand.seoTitle ?? undefined,
          seoDescription: brand.seoDescription ?? undefined,
        }
      : { logoUrl: '', isActive: true, sortOrder: 0 },
  });
  const logoUrl = useWatch({ control, name: 'logoUrl' });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const body = toInput(values);
      const saved = brand
        ? await browserApi.patch<BrandDetail>(`/admin/brands/${brand.id}`, body)
        : await browserApi.post<BrandDetail>('/admin/brands', body);
      onSaved(saved);
    } catch (error) {
      setServerError(adminErrorMessage(error));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {serverError ? <Alert tone="error">{serverError}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={adminFa.common.name} error={errors.name?.message} {...register('name')} />
        <TextField
          label={adminFa.common.nameEn}
          optional
          dir="ltr"
          className="text-left"
          error={errors.nameEn?.message}
          {...register('nameEn')}
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
        <TextField
          label={adminFa.common.sortOrder}
          inputMode="numeric"
          dir="ltr"
          className="text-left"
          error={errors.sortOrder?.message}
          {...register('sortOrder')}
        />
      </div>
      <TextAreaField
        label={adminFa.common.description}
        optional
        error={errors.description?.message}
        {...register('description')}
      />
      <ImageUploadField
        label={copy.logo}
        value={logoUrl}
        onChange={(url) => setValue('logoUrl', url, { shouldDirty: true })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={adminFa.common.seoTitle}
          optional
          error={errors.seoTitle?.message}
          {...register('seoTitle')}
        />
        <TextField
          label={adminFa.common.seoDescription}
          optional
          error={errors.seoDescription?.message}
          {...register('seoDescription')}
        />
      </div>
      <Checkbox label={copy.isActive} {...register('isActive')} />
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
