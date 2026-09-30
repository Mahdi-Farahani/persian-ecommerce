import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Container } from '@/components/layout/container';
import { SellerNav } from '@/components/seller/seller-nav';
import { SellerStatusCard } from '@/components/seller/seller-status-card';
import { t } from '@/i18n';
import { requireUser } from '@/lib/auth/server';
import { getSellerProfile } from '@/lib/seller/server';

export const metadata: Metadata = { title: t.seller.title, robots: { index: false } };

/**
 * Seller portal shell. Visitors without an application are sent to apply;
 * applicants who are not (yet) approved see their status instead of the pages.
 */
export default async function SellerPortalLayout({ children }: { children: ReactNode }) {
  await requireUser('/seller');
  const profile = await getSellerProfile();
  if (!profile) redirect('/seller/apply');

  if (profile.status !== 'APPROVED') {
    return (
      <Container className="py-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <h1 className="text-xl font-bold">{t.seller.status.notApprovedTitle}</h1>
          <SellerStatusCard profile={profile} />
          <Link href="/seller/apply" className="text-sm text-brand-700 hover:underline">
            {t.seller.status.editApplication}
          </Link>
        </div>
      </Container>
    );
  }

  return (
    <Container className="grid gap-6 py-8 lg:grid-cols-[240px_1fr]">
      <SellerNav />
      <div className="min-w-0">{children}</div>
    </Container>
  );
}
