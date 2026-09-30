import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { parseListFilters, ProductListing } from '@/components/catalog/product-listing';
import { Container } from '@/components/layout/container';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { t } from '@/i18n';
import { getBrands, getCategory, listProducts } from '@/lib/catalog/api';

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return { title: t.common.notFoundTitle };
  return {
    title: category.seoTitle ?? category.name,
    description: category.seoDescription ?? category.description ?? undefined,
    alternates: { canonical: `/categories/${category.slug}` },
    openGraph: {
      title: category.seoTitle ?? category.name,
      description: category.seoDescription ?? category.description ?? undefined,
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const category = await getCategory(slug);
  if (!category) notFound();
  const filters = parseListFilters(query);
  const [result, brands] = await Promise.all([
    listProducts({ ...filters, category: category.slug }),
    getBrands(),
  ]);
  const crumbs = category.breadcrumb.map((c, index, all) => ({
    label: c.name,
    href: index < all.length - 1 ? `/categories/${c.slug}` : undefined,
  }));

  return (
    <Container className="py-6">
      <div className="mb-4">
        <Breadcrumbs items={[{ label: t.catalog.categories, href: '/categories' }, ...crumbs]} />
      </div>
      {category.description ? (
        <p className="mb-4 text-sm text-ink-muted">{category.description}</p>
      ) : null}
      {category.children.length > 0 ? (
        <nav aria-label={t.catalog.subcategories} className="mb-6 flex flex-wrap gap-2">
          {category.children.map((child) => (
            <Link
              key={child.id}
              href={`/categories/${child.slug}`}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm transition hover:border-brand-400 hover:text-brand-700"
            >
              {child.name}
            </Link>
          ))}
        </nav>
      ) : null}
      <ProductListing
        result={result}
        brands={brands}
        attributes={category.attributes}
        basePath={`/categories/${category.slug}`}
        searchParams={query}
        title={category.name}
      />
    </Container>
  );
}
