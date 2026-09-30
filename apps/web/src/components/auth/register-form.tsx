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
import { registerSchema, type RegisterFormValues } from '@/lib/validation/schemas';
import { useAuthStore } from '@/store/auth-store';
import { sanitizeNextPath } from './login-form';

export function RegisterForm({ nextPath }: { nextPath?: string | null }) {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: yupResolver(registerSchema),
    defaultValues: { email: '', phone: '', firstName: '', lastName: '', acceptTerms: false },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const payload: Record<string, string> = { password: values.password };
    if (values.email) payload.email = values.email;
    if (values.phone) payload.phone = values.phone;
    if (values.firstName) payload.firstName = values.firstName;
    if (values.lastName) payload.lastName = values.lastName;
    try {
      const result = await browserApi.post<AuthResponse>('/auth/register', payload);
      setUser(result.user);
      router.replace(sanitizeNextPath(nextPath));
      router.refresh();
    } catch (error) {
      setServerError(errorMessage(error));
    }
  });

  const identifierError =
    errors.root?.message ?? (errors as { '': { message?: string } })['']?.message;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {serverError ? <Alert tone="error">{serverError}</Alert> : null}
      {identifierError ? <Alert tone="error">{identifierError}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t.auth.firstName}
          autoComplete="given-name"
          optional
          error={errors.firstName?.message}
          {...register('firstName')}
        />
        <TextField
          label={t.auth.lastName}
          autoComplete="family-name"
          optional
          error={errors.lastName?.message}
          {...register('lastName')}
        />
      </div>
      <TextField
        label={t.auth.email}
        type="email"
        autoComplete="email"
        inputMode="email"
        dir="ltr"
        className="text-left"
        hint={t.auth.registerHint}
        error={errors.email?.message}
        {...register('email')}
      />
      <TextField
        label={t.auth.phone}
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        dir="ltr"
        className="text-left"
        placeholder="09123456789"
        error={errors.phone?.message}
        {...register('phone')}
      />
      <TextField
        label={t.auth.password}
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
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-brand-600"
          {...register('acceptTerms')}
        />
        <span>
          {t.auth.termsPrefix}{' '}
          <Link href="/terms" className="text-brand-700 hover:underline" target="_blank">
            {t.auth.termsLink}
          </Link>{' '}
          {t.auth.termsSuffix}
        </span>
      </label>
      {errors.acceptTerms ? (
        <p role="alert" className="-mt-2 text-xs text-accent-600">
          {errors.acceptTerms.message}
        </p>
      ) : null}
      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        {isSubmitting ? t.auth.submitting : t.auth.submitRegister}
      </Button>
      <p className="text-center text-sm text-ink-muted">
        {t.auth.haveAccount}{' '}
        <Link href="/login" className="font-bold text-brand-700 hover:underline">
          {t.nav.login}
        </Link>
      </p>
    </form>
  );
}
