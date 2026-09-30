'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import type { AuthResponse } from '@pe/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/form-field';
import { t } from '@/i18n';
import { browserApi } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/error-message';
import { loginSchema, type LoginFormValues } from '@/lib/validation/schemas';
import { useAuthStore } from '@/store/auth-store';

/** Only same-origin relative paths are honoured as post-login destinations. */
export function sanitizeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/login')) {
    return '/account';
  }
  return next;
}

export function LoginForm({ nextPath }: { nextPath?: string | null }) {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: yupResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const result = await browserApi.post<AuthResponse>('/auth/login', values);
      setUser(result.user);
      router.replace(sanitizeNextPath(nextPath));
      router.refresh();
    } catch (error) {
      setServerError(errorMessage(error));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {serverError ? <Alert tone="error">{serverError}</Alert> : null}
      <TextField
        label={t.auth.identifier}
        autoComplete="username"
        inputMode="email"
        dir="ltr"
        className="text-left"
        error={errors.identifier?.message}
        {...register('identifier')}
      />
      <TextField
        label={t.auth.password}
        type="password"
        autoComplete="current-password"
        dir="ltr"
        className="text-left"
        error={errors.password?.message}
        {...register('password')}
      />
      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-brand-700 hover:underline">
          {t.auth.forgotPassword}
        </Link>
      </div>
      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        {isSubmitting ? t.auth.submitting : t.auth.submitLogin}
      </Button>
      <p className="text-center text-sm text-ink-muted">
        {t.auth.noAccount}{' '}
        <Link href="/register" className="font-bold text-brand-700 hover:underline">
          {t.nav.register}
        </Link>
      </p>
    </form>
  );
}
