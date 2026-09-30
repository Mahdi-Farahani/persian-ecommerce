import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { parseListFilters, ProductListing } from '@/components/catalog/product-listing';
import { Container } from '@/components/layout/container';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { t } from '@/i18n';
import { getBrand, listProducts } from '@/lib/catalog/api';

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrand(slug);
  if (!brand) return { title: t.common.notFoundTitle };
  return {
    title: brand.seoTitle ?? brand.name,
    description: brand.seoDescription ?? brand.description ?? undefined,
    alternates: { canonical: `/brands/${brand.slug}` },
  };
}

export default async function BrandPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const brand = await getBrand(slug);
  if (!brand) notFound();
  const filters = parseListFilters(query);
  const result = await listProducts({ ...filters, brand: brand.slug });
  return (
    <Container className="py-6">
      <div className="mb-4">
        <Breadcrumbs items={[{ label: t.catalog.brands }, { label: brand.name }]} />
      </div>
      {brand.description ? (
        <p className="mb-4 text-sm text-ink-muted">{brand.description}</p>
      ) : null}
      <ProductListing
        result={result}
        brands={[]}
        attributes={[]}
        basePath={`/brands/${brand.slug}`}
        searchParams={query}
        title={brand.name}
      />
    </Container>
  );
}
