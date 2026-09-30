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
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '@/lib/validation/schemas';

export function ForgotPasswordForm() {
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({ resolver: yupResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await browserApi.post('/auth/forgot-password', values);
      setDone(true);
    } catch (error) {
      setServerError(errorMessage(error));
    }
  });

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success">{t.auth.forgotDone}</Alert>
        <Link
          href="/login"
          className="text-center text-sm font-bold text-brand-700 hover:underline"
        >
          {t.auth.backToLogin}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {serverError ? <Alert tone="error">{serverError}</Alert> : null}
      <TextField
        label={t.auth.identifier}
        autoComplete="username"
        dir="ltr"
        className="text-left"
        error={errors.identifier?.message}
        {...register('identifier')}
      />
      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        {isSubmitting ? t.auth.submitting : t.auth.forgotSubmit}
      </Button>
      <Link href="/login" className="text-center text-sm text-brand-700 hover:underline">
        {t.auth.backToLogin}
      </Link>
    </form>
  );
}
