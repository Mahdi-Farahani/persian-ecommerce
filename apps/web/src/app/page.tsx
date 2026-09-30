import Image from 'next/image';
import Link from 'next/link';
import { ProductGrid } from '@/components/catalog/product-grid';
import { Container } from '@/components/layout/container';
import { t } from '@/i18n';
import { assetUrl } from '@/lib/assets';
import { getCategoryTree, listProducts } from '@/lib/catalog/api';

const features = [
  { title: t.home.features.fastDelivery, body: t.home.features.fastDeliveryBody },
  { title: t.home.features.securePayment, body: t.home.features.securePaymentBody },
  { title: t.home.features.support, body: t.home.features.supportBody },
  { title: t.home.features.returns, body: t.home.features.returnsBody },
];

export default async function HomePage() {
  const [tree, latest, discounted] = await Promise.all([
    getCategoryTree(),
    listProducts({ sort: 'newest', limit: 8 }).catch(() => null),
    listProducts({ sort: 'popular', limit: 4, inStock: true }).catch(() => null),
  ]);
  const featuredCategories = tree
    .flatMap((root) => (root.children.length ? root.children : [root]))
    .slice(0, 8);

  return (
    <Container className="py-8">
      <section className="rounded-card bg-gradient-to-l from-brand-700 to-brand-500 px-6 py-12 text-white sm:px-12 sm:py-16">
        <h1 className="text-3xl font-extrabold sm:text-4xl">{t.home.heroTitle}</h1>
        <p className="mt-3 max-w-xl text-base text-brand-50 sm:text-lg">{t.home.heroSubtitle}</p>
        <Link
          href="/products"
          className="mt-6 inline-flex rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-brand-700 shadow transition hover:bg-brand-50"
        >
          {t.home.shopNow}
        </Link>
      </section>

      {featuredCategories.length > 0 ? (
        <section aria-labelledby="home-categories" className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="home-categories" className="text-lg font-bold">
              {t.catalog.home.categories}
            </h2>
            <Link href="/categories" className="text-sm text-brand-700 hover:underline">
              {t.catalog.seeAll}
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {featuredCategories.map((category) => {
              const image = assetUrl(category.imageUrl);
              return (
                <li key={category.id}>
                  <Link
                    href={`/categories/${category.slug}`}
                    className="flex flex-col items-center gap-2 rounded-card border border-border bg-surface p-3 text-center text-sm transition hover:border-brand-400 hover:text-brand-700"
                  >
                    {image ? (
                      <Image
                        src={image}
                        alt=""
                        width={56}
                        height={56}
                        className="size-14 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="grid size-14 place-items-center rounded-full bg-brand-50 text-lg font-bold text-brand-700"
                      >
                        {category.name.slice(0, 1)}
                      </span>
                    )}
                    <span className="line-clamp-1">{category.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {discounted && discounted.items.length > 0 ? (
        <section aria-labelledby="home-discounted" className="mt-10">
          <h2 id="home-discounted" className="mb-3 text-lg font-bold">
            {t.catalog.home.discounted}
          </h2>
          <ProductGrid products={discounted.items} />
        </section>
      ) : null}

      {latest && latest.items.length > 0 ? (
        <section aria-labelledby="home-latest" className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="home-latest" className="text-lg font-bold">
              {t.catalog.home.latest}
            </h2>
            <Link href="/products" className="text-sm text-brand-700 hover:underline">
              {t.catalog.seeAll}
            </Link>
          </div>
          <ProductGrid products={latest.items} />
        </section>
      ) : null}

      <section aria-labelledby="features-heading" className="mt-10">
        <h2 id="features-heading" className="sr-only">
          {t.app.tagline}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <li key={feature.title} className="rounded-card border border-border bg-surface p-5">
              <h3 className="font-bold">{feature.title}</h3>
              <p className="mt-1 text-sm text-ink-muted">{feature.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </Container>
  );
}
