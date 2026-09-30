'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/form-field';
import { t } from '@/i18n';
import { browserApi } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/error-message';
import { resetPasswordSchema, type ResetPasswordFormValues } from '@/lib/validation/schemas';

export function ResetPasswordForm({ token }: { token: string | null }) {
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({ resolver: yupResolver(resetPasswordSchema) });

  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="error">{t.auth.resetInvalid}</Alert>
        <Link
          href="/forgot-password"
          className="text-center text-sm font-bold text-brand-700 hover:underline"
        >
          {t.auth.forgotTitle}
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success">{t.auth.resetDone}</Alert>
        <Link
          href="/login"
          className="text-center text-sm font-bold text-brand-700 hover:underline"
        >
          {t.auth.backToLogin}
        </Link>
      </div>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await browserApi.post('/auth/reset-password', { token, password: values.password });
      setDone(true);
    } catch (error) {
      setServerError(errorMessage(error));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {serverError ? <Alert tone="error">{serverError}</Alert> : null}
      <TextField
        label={t.auth.newPassword}
        type="password"
        autoComplete="new-password"
        dir="ltr"
        className="text-left"
        hint={t.validation.passwordPolicy}
        error={errors.password?.message}
        {...register('password')}
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
      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        {isSubmitting ? t.auth.submitting : t.auth.resetSubmit}
      </Button>
    </form>
  );
}
