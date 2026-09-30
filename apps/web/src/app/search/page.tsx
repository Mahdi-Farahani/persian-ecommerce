import type { Metadata } from 'next';
import { SearchEmptyState, SearchPrompt } from '@/components/catalog/search-empty-state';
import { parseListFilters, ProductListing } from '@/components/catalog/product-listing';
import { Container } from '@/components/layout/container';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { t } from '@/i18n';
import { getBrands, searchProducts } from '@/lib/catalog/api';
import { hasActiveFilters, type SearchParamsRecord } from '@/lib/catalog/listing';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>;
}): Promise<Metadata> {
  const filters = parseListFilters(await searchParams);
  return {
    title: filters.q ? t.search.resultsFor(filters.q) : t.search.title,
    // Result pages are personal to the query and must not end up in indexes.
    robots: { index: false, follow: false },
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>;
}) {
  const params = await searchParams;
  const filters = parseListFilters(params, { defaultSort: 'relevance' });
  const query = filters.q;

  if (!query) {
    return (
      <Container className="py-6">
        <div className="mb-4">
          <Breadcrumbs items={[{ label: t.search.title }]} />
        </div>
        <SearchPrompt />
      </Container>
    );
  }

  const [result, brands] = await Promise.all([searchProducts(filters), getBrands()]);

  return (
    <Container className="py-6">
      <div className="mb-4">
        <Breadcrumbs items={[{ label: t.search.title }]} />
      </div>
      <ProductListing
        result={result}
        brands={brands}
        attributes={[]}
        basePath="/search"
        searchParams={params}
        title={t.search.resultsFor(query)}
        defaultSort="relevance"
        empty={<SearchEmptyState query={query} filtered={hasActiveFilters(params)} />}
      />
    </Container>
  );
}
