import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { toPersianDigits } from '@pe/shared';
import { ProductGrid } from '@/components/catalog/product-grid';
import { ProductPurchasePanel } from '@/components/catalog/product-purchase-panel';
import { Container } from '@/components/layout/container';
import { ProductReviews } from '@/components/reviews/product-reviews';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { t } from '@/i18n';
import { assetUrl } from '@/lib/assets';
import { getProduct, listProducts } from '@/lib/catalog/api';
import { env } from '@/lib/env';
import { getProductReviewsPage, listProductReviews } from '@/lib/reviews/server';
import { REVIEWS_PAGE_SIZE } from '@/lib/reviews/sorting';

const EMPTY_REVIEWS = {
  items: [],
  pagination: { page: 1, limit: REVIEWS_PAGE_SIZE, total: 0, totalPages: 0 },
};

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: t.common.notFoundTitle };
  const image = assetUrl(product.images[0]?.url);
  return {
    title: product.seoTitle ?? product.title,
    description: product.seoDescription ?? product.shortDescription ?? undefined,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      type: 'website',
      title: product.seoTitle ?? product.title,
      description: product.seoDescription ?? product.shortDescription ?? undefined,
      images: image ? [{ url: image }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  const [related, reviewsPage, reviews] = await Promise.all([
    listProducts({ category: product.category.slug, limit: 4, sort: 'popular' }),
    getProductReviewsPage(product.id),
    listProductReviews(product.id),
  ]);
  const relatedItems = related.items.filter((p) => p.id !== product.id).slice(0, 4);
  const crumbs = product.breadcrumb.map((c) => ({ label: c.name, href: `/categories/${c.slug}` }));
  const specGroups = groupSpecifications(product.specifications);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.shortDescription ?? undefined,
    sku: product.variants[0]?.sku,
    brand: product.brand ? { '@type': 'Brand', name: product.brand.name } : undefined,
    image: product.images.map((i) => `${env.appUrl}${i.url}`),
    offers:
      product.price !== null
        ? {
            '@type': 'AggregateOffer',
            priceCurrency: 'IRR',
            lowPrice: product.price,
            highPrice: Math.max(...product.variants.map((v) => v.price), product.price),
            offerCount: product.variants.length,
            availability: product.inStock
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
            url: `${env.appUrl}/products/${product.slug}`,
          }
        : undefined,
    aggregateRating:
      product.ratingCount > 0
        ? {
            '@type': 'AggregateRating',
            ratingValue: product.ratingAverage,
            reviewCount: product.ratingCount,
          }
        : undefined,
  };

  return (
    <Container className="py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mb-4">
        <Breadcrumbs items={[...crumbs, { label: product.title }]} />
      </div>
      <header className="mb-6">
        <h1 className="text-xl font-bold sm:text-2xl">{product.title}</h1>
        {product.titleEn ? (
          <p className="mt-1 text-sm text-ink-muted" dir="ltr">
            {product.titleEn}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
          {product.brand ? (
            <Link href={`/brands/${product.brand.slug}`} className="hover:text-brand-700">
              {t.catalog.brand}: {product.brand.name}
            </Link>
          ) : null}
          {product.ratingCount > 0 ? (
            <span>
              ★ {toPersianDigits(product.ratingAverage.toFixed(1))} (
              {toPersianDigits(product.ratingCount)})
            </span>
          ) : null}
        </div>
      </header>

      <ProductPurchasePanel product={product} />

      <section className="mt-8 grid gap-3 rounded-card border border-border bg-surface p-4 text-sm sm:grid-cols-2">
        <p>✓ {t.catalog.guarantee}</p>
        <p>✓ {t.catalog.delivery}</p>
      </section>

      {product.attributes.length > 0 ? (
        <section className="mt-8" aria-labelledby="features-heading">
          <h2 id="features-heading" className="mb-3 text-lg font-bold">
            {t.catalog.features}
          </h2>
          <dl className="grid gap-2 rounded-card border border-border bg-surface p-4 sm:grid-cols-2">
            {product.attributes.map((attribute) => (
              <div
                key={attribute.attributeId}
                className="flex justify-between gap-4 border-b border-border/60 py-1 text-sm last:border-0"
              >
                <dt className="text-ink-muted">{attribute.name}</dt>
                <dd className="font-medium">{attribute.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {product.description ? (
        <section className="mt-8" aria-labelledby="description-heading">
          <h2 id="description-heading" className="mb-3 text-lg font-bold">
            {t.catalog.description}
          </h2>
          <div className="rounded-card border border-border bg-surface p-4 text-sm leading-8 whitespace-pre-line">
            {product.description}
          </div>
        </section>
      ) : null}

      {specGroups.length > 0 ? (
        <section className="mt-8" aria-labelledby="specs-heading">
          <h2 id="specs-heading" className="mb-3 text-lg font-bold">
            {t.catalog.specifications}
          </h2>
          <div className="overflow-hidden rounded-card border border-border bg-surface">
            {specGroups.map((group) => (
              <table key={group.name ?? 'default'} className="w-full text-sm">
                {group.name ? (
                  <caption className="bg-surface-muted px-4 py-2 text-start font-bold">
                    {group.name}
                  </caption>
                ) : null}
                <tbody>
                  {group.rows.map((row) => (
                    <tr key={row.id} className="border-t border-border/60">
                      <th
                        scope="row"
                        className="w-1/3 px-4 py-2 text-start font-normal text-ink-muted"
                      >
                        {row.name}
                      </th>
                      <td className="px-4 py-2">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        </section>
      ) : null}

      {reviewsPage ? (
        <ProductReviews
          productId={product.id}
          productSlug={product.slug}
          initialPage={reviewsPage}
          initialReviews={reviews ?? EMPTY_REVIEWS}
        />
      ) : null}

      {relatedItems.length > 0 ? (
        <section className="mt-10" aria-labelledby="related-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="related-heading" className="text-lg font-bold">
              {t.catalog.relatedProducts}
            </h2>
            <Link
              href={`/categories/${product.category.slug}`}
              className="text-sm text-brand-700 hover:underline"
            >
              {t.catalog.seeAll}
            </Link>
          </div>
          <ProductGrid products={relatedItems} />
        </section>
      ) : null}
    </Container>
  );
}

function groupSpecifications(
  rows: ProductPageSpec[],
): Array<{ name: string | null; rows: ProductPageSpec[] }> {
  const groups = new Map<string | null, ProductPageSpec[]>();
  for (const row of rows) {
    const list = groups.get(row.group) ?? [];
    list.push(row);
    groups.set(row.group, list);
  }
  return [...groups.entries()].map(([name, list]) => ({ name, rows: list }));
}

type ProductPageSpec = {
  id: string;
  group: string | null;
  name: string;
  value: string;
  sortOrder: number;
};
