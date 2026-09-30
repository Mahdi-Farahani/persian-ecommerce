import Link from 'next/link';
import { toPersianDigits } from '@pe/shared';
import { t } from '@/i18n';
import { Container } from './container';

const columns = [
  {
    title: t.footer.customerService,
    links: [
      { href: '/faq', label: t.footer.faq },
      { href: '/contact', label: t.footer.contact },
      { href: '/terms', label: t.footer.terms },
      { href: '/privacy', label: t.footer.privacy },
    ],
  },
  {
    title: t.footer.company,
    links: [
      { href: '/about', label: t.footer.about },
      { href: '/seller/apply', label: t.footer.sellWithUs },
    ],
  },
] as const;

export function SiteFooter() {
  const year = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' }).format(
    new Date(),
  );
  return (
    <footer className="mt-12 border-t border-border bg-surface">
      <Container className="grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <p className="text-xl font-extrabold text-brand-700">{t.app.name}</p>
          <p className="mt-2 max-w-md text-sm text-ink-muted">{t.app.description}</p>
        </div>
        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="mb-3 text-sm font-bold">{column.title}</h2>
            <ul className="space-y-2 text-sm text-ink-muted">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-brand-700">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>
      <div className="border-t border-border py-4 text-center text-xs text-ink-muted">
        © {toPersianDigits(year)} {t.app.name} — {t.footer.copyright}
      </div>
    </footer>
  );
}
