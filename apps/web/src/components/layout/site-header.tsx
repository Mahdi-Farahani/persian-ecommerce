import Link from 'next/link';
import { t } from '@/i18n';
import { Container } from './container';
import { HeaderActions } from './header-actions';
import { MobileMenu } from './mobile-menu';
import { SearchForm } from './search-form';

export const primaryNavigation = [
  { href: '/', label: t.nav.home },
  { href: '/categories', label: t.nav.categories },
  { href: '/products', label: t.nav.products },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
      <Container className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2 sm:gap-x-6 md:h-16 md:flex-nowrap md:py-0">
        <MobileMenu items={primaryNavigation} />
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-xl font-extrabold text-brand-700"
        >
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-lg bg-brand-600 text-white"
          >
            ب
          </span>
          <span>{t.app.name}</span>
        </Link>
        {/* Single search form: full-width second row on mobile, inline on desktop. */}
        <div className="order-last w-full md:order-none md:w-auto md:flex-1">
          <SearchForm />
        </div>
        <HeaderActions />
      </Container>
      <nav aria-label={t.nav.menu} className="hidden border-t border-border bg-surface md:block">
        <Container>
          <ul className="flex h-11 items-center gap-6 text-sm font-medium text-ink-muted">
            {primaryNavigation.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="transition-colors hover:text-brand-700">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </nav>
    </header>
  );
}
