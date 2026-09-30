'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { REVIEW_BODY_MAX, REVIEW_TITLE_MAX, type ReviewView } from '@pe/shared';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextAreaField, TextField } from '@/components/ui/form-field';
import { t } from '@/i18n';
import { browserApi } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/error-message';
import { reviewSchema, type ReviewFormValues } from '@/lib/validation/schemas';
import { StarPicker } from './star-picker';

interface ReviewFormProps {
  productId: string;
  /** When set the form edits this review (PATCH) instead of creating one (POST). */
  review?: Pick<ReviewView, 'id' | 'rating' | 'title' | 'body'> | null;
  onSaved: (review: ReviewView) => void;
  onCancel?: () => void;
}

const copy = t.reviews.form;

/** Create/edit form for a product review (star picker, title and body). */
export function ReviewForm({ productId, review, onSaved, onCancel }: ReviewFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ReviewFormValues>({
    resolver: yupResolver(reviewSchema),
    defaultValues: review
      ? { rating: review.rating, title: review.title, body: review.body }
      : { title: '', body: '' },
  });
  // Radios report their value as a string until yup casts it on submit.
  const rating = Number(useWatch({ control, name: 'rating' }));

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const saved = review
        ? await browserApi.patch<ReviewView>(`/reviews/${encodeURIComponent(review.id)}`, values)
        : await browserApi.post<ReviewView>(
            `/products/${encodeURIComponent(productId)}/reviews`,
            values,
          );
      onSaved(saved);
    } catch (error) {
      setServerError(errorMessage(error));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {serverError ? <Alert tone="error">{serverError}</Alert> : null}
      <StarPicker
        label={copy.rating}
        value={rating > 0 ? rating : undefined}
        error={errors.rating?.message}
        disabled={isSubmitting}
        {...register('rating')}
      />
      <TextField
        label={copy.title}
        maxLength={REVIEW_TITLE_MAX}
        error={errors.title?.message}
        disabled={isSubmitting}
        {...register('title')}
      />
      <TextAreaField
        label={copy.body}
        placeholder={copy.bodyPlaceholder}
        maxLength={REVIEW_BODY_MAX}
        className="min-h-32"
        error={errors.body?.message}
        disabled={isSubmitting}
        {...register('body')}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? copy.submitting : review ? copy.update : copy.submit}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            {t.common.cancel}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
