import type { Metadata } from 'next';
import { Container } from '@/components/layout/container';
import { SellerApplyPanel } from '@/components/seller/seller-apply-panel';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { t } from '@/i18n';
import { requireUser } from '@/lib/auth/server';
import { getSellerProfile } from '@/lib/seller/server';

export const metadata: Metadata = { title: t.seller.apply.title, robots: { index: false } };

export default async function SellerApplyPage() {
  await requireUser('/seller/apply');
  const profile = await getSellerProfile();
  return (
    <Container className="py-8">
      <div className="mb-4">
        <Breadcrumbs items={[{ label: t.seller.apply.title }]} />
      </div>
      <div className="mx-auto max-w-3xl">
        <SellerApplyPanel initialProfile={profile} />
      </div>
    </Container>
  );
}
