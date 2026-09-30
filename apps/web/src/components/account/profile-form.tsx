'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import type { AuthUser } from '@pe/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/form-field';
import { t } from '@/i18n';
import { browserApi } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/error-message';
import { profileSchema, type ProfileFormValues } from '@/lib/validation/schemas';
import { useAuthStore } from '@/store/auth-store';

export function ProfileForm({ user }: { user: AuthUser }) {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: yupResolver(profileSchema),
    defaultValues: { firstName: user.firstName ?? '', lastName: user.lastName ?? '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setStatus(null);
    try {
      const updated = await browserApi.patch<AuthUser>('/users/me', values);
      setUser(updated);
      setStatus({ tone: 'success', message: t.account.profileSaved });
      router.refresh();
    } catch (error) {
      setStatus({ tone: 'error', message: errorMessage(error) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {status ? <Alert tone={status.tone}>{status.message}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t.auth.firstName}
          autoComplete="given-name"
          error={errors.firstName?.message}
          {...register('firstName')}
        />
        <TextField
          label={t.auth.lastName}
          autoComplete="family-name"
          error={errors.lastName?.message}
          {...register('lastName')}
        />
      </div>
      <div>
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          {isSubmitting ? t.common.saving : t.common.save}
        </Button>
      </div>
    </form>
  );
}
