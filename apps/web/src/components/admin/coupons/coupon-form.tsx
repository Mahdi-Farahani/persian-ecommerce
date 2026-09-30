'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { formatPersianNumber } from '@pe/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Checkbox } from '@/components/admin/checkbox';
import type { Notice } from '@/components/admin/notice';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SelectField, TextAreaField, TextField } from '@/components/ui/form-field';
import { t } from '@/i18n';
import { adminFa } from '@/i18n/admin-fa';
import {
  couponFormToInput,
  couponToFormValues,
  emptyCouponFormValues,
} from '@/lib/admin/coupon-mappers';
import { adminErrorMessage } from '@/lib/admin/errors';
import { couponSchema, type CouponFormValues } from '@/lib/admin/schemas';
import { CouponTypes, type AdminCoupon } from '@/lib/admin/types';
import { browserApi } from '@/lib/api/client';

const copy = adminFa.coupons;

const typeOptions = CouponTypes.map((type) => ({ value: type, label: copy.types[type] ?? type }));

interface CouponFormProps {
  coupon?: AdminCoupon;
  /** Shown once after the create → edit redirect. */
  justCreated?: boolean;
}

export function CouponForm({ coupon, justCreated = false }: CouponFormProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(
    justCreated ? { tone: 'success', message: copy.created } : null,
  );
  const [deleting, setDeleting] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CouponFormValues>({
    resolver: yupResolver(couponSchema),
    defaultValues: coupon ? couponToFormValues(coupon) : emptyCouponFormValues(),
  });
  const type = useWatch({ control, name: 'type' });
  const isPercentage = type === 'PERCENTAGE';

  const onSubmit = handleSubmit(async (values) => {
    setNotice(null);
    try {
      const body = couponFormToInput(values);
      if (coupon) {
        await browserApi.patch<AdminCoupon>(`/admin/coupons/${coupon.id}`, body);
        setNotice({ tone: 'success', message: copy.saved });
        router.refresh();
      } else {
        const created = await browserApi.post<AdminCoupon>('/admin/coupons', body);
        router.push(`/admin/coupons/${created.id}?created=1`);
      }
    } catch (error) {
      setNotice({ tone: 'error', message: adminErrorMessage(error) });
    }
  });

  const remove = async () => {
    if (!coupon || !window.confirm(copy.deleteConfirm)) return;
    setDeleting(true);
    setNotice(null);
    try {
      await browserApi.delete(`/admin/coupons/${coupon.id}`);
      router.push('/admin/coupons');
    } catch (error) {
      setNotice({ tone: 'error', message: adminErrorMessage(error) });
      setDeleting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {notice ? <Alert tone={notice.tone}>{notice.message}</Alert> : null}

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-sm font-bold">{copy.sections.basic}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={copy.fields.code}
            hint={copy.fields.codeHint}
            dir="ltr"
            className="text-left font-mono uppercase"
            autoComplete="off"
            error={errors.code?.message}
            {...register('code')}
          />
          <SelectField
            label={copy.fields.type}
            options={typeOptions}
            error={errors.type?.message}
            {...register('type')}
          />
          <TextField
            label={isPercentage ? copy.fields.percent : copy.fields.fixedAmount}
            inputMode="numeric"
            dir="ltr"
            className="text-left"
            error={errors.value?.message}
            {...register('value')}
          />
          {isPercentage ? (
            <TextField
              label={copy.fields.maxDiscountAmount}
              optional
              hint={copy.fields.maxDiscountHint}
              inputMode="numeric"
              dir="ltr"
              className="text-left"
              error={errors.maxDiscountToman?.message}
              {...register('maxDiscountToman')}
            />
          ) : null}
        </div>
        <TextAreaField
          label={copy.fields.description}
          optional
          className="min-h-20"
          error={errors.description?.message}
          {...register('description')}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-sm font-bold">{copy.sections.limits}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={copy.fields.minCartAmount}
            optional
            inputMode="numeric"
            dir="ltr"
            className="text-left"
            error={errors.minCartToman?.message}
            {...register('minCartToman')}
          />
          <div className="hidden sm:block" />
          <TextField
            label={copy.fields.startsAt}
            optional
            type="datetime-local"
            dir="ltr"
            error={errors.startsAt?.message}
            {...register('startsAt')}
          />
          <TextField
            label={copy.fields.endsAt}
            optional
            type="datetime-local"
            dir="ltr"
            error={errors.endsAt?.message}
            {...register('endsAt')}
          />
          <TextField
            label={copy.fields.usageLimit}
            optional
            inputMode="numeric"
            dir="ltr"
            className="text-left"
            error={errors.usageLimit?.message}
            {...register('usageLimit')}
          />
          <TextField
            label={copy.fields.usageLimitPerUser}
            optional
            inputMode="numeric"
            dir="ltr"
            className="text-left"
            error={errors.usageLimitPerUser?.message}
            {...register('usageLimitPerUser')}
          />
        </div>
        <Checkbox label={copy.fields.isActive} {...register('isActive')} />
        {coupon ? (
          <p className="text-xs text-ink-muted">
            {copy.fields.usedCount}: {formatPersianNumber(coupon.usedCount)}
          </p>
        ) : null}
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? t.common.saving : coupon ? t.common.save : adminFa.common.create}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/admin/coupons')}>
          {t.common.cancel}
        </Button>
        {coupon ? (
          <Button
            type="button"
            variant="ghost"
            className="ms-auto text-accent-600"
            loading={deleting}
            onClick={remove}
          >
            {t.common.delete}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
