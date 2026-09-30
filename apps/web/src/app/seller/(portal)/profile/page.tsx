import type { Metadata } from 'next';
import Link from 'next/link';
import { SellerApplicationForm } from '@/components/seller/seller-application-form';
import { SellerStatusCard } from '@/components/seller/seller-status-card';
import { Card, CardTitle } from '@/components/ui/card';
import { t } from '@/i18n';
import { getApprovedSeller } from '@/lib/seller/server';

export const metadata: Metadata = { title: t.seller.profile.title, robots: { index: false } };

const copy = t.seller.profile;

export default async function SellerProfilePage() {
  const seller = await getApprovedSeller();
  if (!seller) return null;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">{copy.title}</h1>
        <p className="text-sm text-ink-muted">{copy.subtitle}</p>
      </div>
      <SellerStatusCard profile={seller} />
      <Card>
        <CardTitle>{t.seller.status.editApplication}</CardTitle>
        <SellerApplicationForm profile={seller} />
      </Card>
      <Card className="text-sm">
        <p className="text-ink-muted">{copy.storeUrl}</p>
        <Link
          href={`/sellers/${seller.slug}`}
          className="font-medium text-brand-700 hover:underline"
        >
          {copy.viewStore}
        </Link>
      </Card>
    </div>
  );
}
