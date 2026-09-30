'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/form-field';
import { t } from '@/i18n';
import { browserApi } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/error-message';
import { changePasswordSchema, type ChangePasswordFormValues } from '@/lib/validation/schemas';

export function ChangePasswordForm() {
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({ resolver: yupResolver(changePasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setStatus(null);
    try {
      await browserApi.post('/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      reset();
      setStatus({ tone: 'success', message: t.account.passwordChanged });
    } catch (error) {
      setStatus({ tone: 'error', message: errorMessage(error) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-md flex-col gap-4">
      {status ? <Alert tone={status.tone}>{status.message}</Alert> : null}
      <TextField
        label={t.auth.currentPassword}
        type="password"
        autoComplete="current-password"
        dir="ltr"
        className="text-left"
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />
      <TextField
        label={t.auth.newPassword}
        type="password"
        autoComplete="new-password"
        dir="ltr"
        className="text-left"
        hint={t.validation.passwordPolicy}
        error={errors.newPassword?.message}
        {...register('newPassword')}
      />
      <TextField
        label={t.auth.confirmPassword}
        type="password"
        autoComplete="new-password"
        dir="ltr"
        className="text-left"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />
      <div>
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? t.common.saving : t.account.changePassword}
        </Button>
      </div>
    </form>
  );
}
