import Link from 'next/link';
import { Container } from '@/components/layout/container';
import { t } from '@/i18n';

const features = [
  { title: t.home.features.fastDelivery, body: t.home.features.fastDeliveryBody },
  { title: t.home.features.securePayment, body: t.home.features.securePaymentBody },
  { title: t.home.features.support, body: t.home.features.supportBody },
  { title: t.home.features.returns, body: t.home.features.returnsBody },
];

export default function HomePage() {
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
