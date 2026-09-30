import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container } from '@/components/layout/container';
import { SellerBadge } from '@/components/seller/badge';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Card } from '@/components/ui/card';
import { t } from '@/i18n';
import { getPublicSeller } from '@/lib/seller/server';

const copy = t.seller.store;

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const seller = await getPublicSeller(slug);
  if (!seller) return { title: t.common.notFoundTitle };
  return {
    title: copy.title(seller.storeName),
    description: seller.description ?? undefined,
    alternates: { canonical: `/sellers/${seller.slug}` },
  };
}

/** Public storefront identity of a marketplace seller. */
export default async function SellerStorePage({ params }: { params: Params }) {
  const { slug } = await params;
  const seller = await getPublicSeller(slug);
  if (!seller) notFound();

  return (
    <Container className="py-6">
      <div className="mb-4">
        <Breadcrumbs items={[{ label: copy.title(seller.storeName) }]} />
      </div>
      <Card className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-14 place-items-center rounded-full bg-brand-50 text-xl font-bold text-brand-700"
          >
            {seller.storeName.slice(0, 1)}
          </span>
          <div>
            <h1 className="text-xl font-bold">{copy.title(seller.storeName)}</h1>
            <SellerBadge tone="success" className="mt-1">
              {copy.badge}
            </SellerBadge>
          </div>
        </div>
        <p className="mt-5 text-sm leading-7 whitespace-pre-line">
          {seller.description ?? <span className="text-ink-muted">{copy.noDescription}</span>}
        </p>
        <p className="mt-4 text-xs text-ink-muted">{copy.note}</p>
        <Link
          href="/products"
          className="mt-5 inline-flex h-11 items-center rounded-lg bg-brand-600 px-5 text-sm font-bold text-white hover:bg-brand-700"
        >
          {copy.browseProducts}
        </Link>
      </Card>
    </Container>
  );
}
