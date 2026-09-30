import type { Metadata } from 'next';
import { Container } from '@/components/layout/container';
import { parseListFilters, ProductListing } from '@/components/catalog/product-listing';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { t } from '@/i18n';
import { getBrands, listProducts } from '@/lib/catalog/api';

type SearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const q = Array.isArray(params.q) ? params.q[0] : params.q;
  return {
    title: q ? t.catalog.searchResults(q) : t.catalog.allProducts,
    alternates: { canonical: '/products' },
    robots: q ? { index: false } : undefined,
  };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filters = parseListFilters(params);
  const [result, brands] = await Promise.all([listProducts(filters), getBrands()]);
  const title = filters.q ? t.catalog.searchResults(filters.q) : t.catalog.allProducts;
  return (
    <Container className="py-6">
      <div className="mb-4">
        <Breadcrumbs items={[{ label: t.catalog.products }]} />
      </div>
      <ProductListing
        result={result}
        brands={brands}
        attributes={[]}
        basePath="/products"
        searchParams={params}
        title={title}
      />
    </Container>
  );
}
