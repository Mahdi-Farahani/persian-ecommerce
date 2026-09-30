import type { Metadata } from 'next';
import Link from 'next/link';
import { NewOfferForm } from '@/components/seller/new-offer-form';
import { t } from '@/i18n';
import { getApprovedSeller } from '@/lib/seller/server';

export const metadata: Metadata = { title: t.seller.newOffer.title, robots: { index: false } };

export default async function SellerNewOfferPage() {
  const seller = await getApprovedSeller();
  if (!seller) return null;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/seller/products" className="text-xs text-ink-muted hover:text-brand-700">
          ‹ {t.seller.nav.products}
        </Link>
        <h1 className="mt-1 text-xl font-bold">{t.seller.newOffer.title}</h1>
      </div>
      <NewOfferForm />
    </div>
  );
}
