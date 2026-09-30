import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth/auth-card';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { t } from '@/i18n';

export const metadata: Metadata = { title: t.auth.resetTitle, robots: { index: false } };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthCard title={t.auth.resetTitle}>
      <ResetPasswordForm token={token ?? null} />
    </AuthCard>
  );
}
