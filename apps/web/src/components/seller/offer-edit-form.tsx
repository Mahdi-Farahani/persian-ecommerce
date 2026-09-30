'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import type { SellerOfferView } from '@pe/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/form-field';
import { t } from '@/i18n';
import { browserApi } from '@/lib/api/client';
import { sellerErrorMessage } from '@/lib/seller/errors';
import {
  OfferStatusOptions,
  rialsToToman,
  sellerOfferEditSchema,
  tomanToRials,
  type SellerOfferEditFormValues,
} from '@/lib/seller/schemas';

const copy = t.seller.offers;

const statusOptions = OfferStatusOptions.map((value) => ({
  value,
  label: copy.status[value] ?? value,
}));

export interface OfferEditFormProps {
  offer: SellerOfferView;
  onSuccess?: (offer: SellerOfferView) => void | Promise<void>;
  onCancel?: () => void;
}

/** Inline editor for an offer's title, prices and status (`PATCH /seller/offers/:id`). */
export function OfferEditForm({ offer, onSuccess, onCancel }: OfferEditFormProps) {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SellerOfferEditFormValues>({
    resolver: yupResolver(sellerOfferEditSchema),
    defaultValues: {
      title: offer.title ?? '',
      price: rialsToToman(offer.price),
      compareAtPrice:
        offer.compareAtPrice === null ? undefined : rialsToToman(offer.compareAtPrice),
      status: offer.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    },
  });

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      const updated = await browserApi.patch<SellerOfferView>(
        `/seller/offers/${encodeURIComponent(offer.variantId)}`,
        {
          title: values.title || null,
          price: tomanToRials(values.price),
          compareAtPrice:
            values.compareAtPrice === undefined ? null : tomanToRials(values.compareAtPrice),
          status: values.status,
        },
      );
      await onSuccess?.(updated);
    } catch (err) {
      setError(sellerErrorMessage(err));
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextField
          label={copy.fields.title}
          optional
          error={errors.title?.message}
          {...register('title')}
        />
        <TextField
          label={copy.fields.price}
          inputMode="numeric"
          dir="ltr"
          className="text-left"
          error={errors.price?.message}
          {...register('price')}
        />
        <TextField
          label={copy.fields.compareAtPrice}
          optional
          inputMode="numeric"
          dir="ltr"
          className="text-left"
          error={errors.compareAtPrice?.message}
          {...register('compareAtPrice')}
        />
        <SelectField
          label={copy.fields.status}
          options={statusOptions}
          error={errors.status?.message}
          {...register('status')}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="secondary" loading={isSubmitting}>
          {t.common.save}
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
