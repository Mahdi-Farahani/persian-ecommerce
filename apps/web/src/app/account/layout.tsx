import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AccountNav } from '@/components/account/account-nav';
import { Container } from '@/components/layout/container';
import { t } from '@/i18n';
import { requireUser } from '@/lib/auth/server';

export const metadata: Metadata = { title: t.account.title, robots: { index: false } };

export default async function AccountLayout({ children }: { children: ReactNode }) {
  await requireUser('/account');
  return (
    <Container className="grid gap-6 py-8 lg:grid-cols-[240px_1fr]">
      <AccountNav />
      <div className="min-w-0">{children}</div>
    </Container>
  );
}
