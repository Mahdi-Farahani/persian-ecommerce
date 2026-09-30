import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth/auth-card';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { t } from '@/i18n';

export const metadata: Metadata = { title: t.auth.forgotTitle, robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title={t.auth.forgotTitle} subtitle={t.auth.forgotSubtitle}>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
