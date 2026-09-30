import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';
import { Container } from '@/components/layout/container';
import { Card } from '@/components/ui/card';
import { adminFa } from '@/i18n/admin-fa';
import { canAccessAdmin, visibleNavItems } from '@/lib/admin/navigation';
import { getCurrentUser } from '@/lib/auth/server';

export const metadata: Metadata = {
  title: { default: adminFa.title, template: `%s | ${adminFa.title}` },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/admin');
  }
  if (!canAccessAdmin(user)) {
    return (
      <Container className="py-12">
        <Card className="mx-auto max-w-lg text-center">
          <h1 className="text-lg font-bold">{adminFa.forbidden.title}</h1>
          <p className="mt-2 text-sm text-ink-muted">{adminFa.forbidden.body}</p>
        </Card>
      </Container>
    );
  }
  return <AdminShell items={visibleNavItems(user)}>{children}</AdminShell>;
}
