'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

const items = [
  { href: '/seller', label: t.seller.nav.dashboard },
  { href: '/seller/products', label: t.seller.nav.products },
  { href: '/seller/products/new', label: t.seller.nav.newOffer },
  { href: '/seller/orders', label: t.seller.nav.orders },
  { href: '/seller/settlements', label: t.seller.nav.settlements },
  { href: '/seller/profile', label: t.seller.nav.profile },
] as const;

function isActive(href: string, pathname: string): boolean {
  if (href === '/seller') return pathname === href;
  if (pathname === href) return true;
  // A more specific sibling (e.g. /seller/products/new) owns its own prefix.
  const moreSpecific = items.some(
    (item) => item.href !== href && item.href.startsWith(`${href}/`) && pathname === item.href,
  );
  return !moreSpecific && pathname.startsWith(`${href}/`);
}

export function SellerNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label={t.seller.title}
      className="rounded-card border border-border bg-surface p-2 lg:sticky lg:top-32 lg:self-start"
    >
      <ul className="flex gap-1 overflow-x-auto lg:flex-col">
        {items.map((item) => {
          const active = isActive(item.href, pathname);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'block rounded-lg px-3 py-2 text-sm font-medium transition',
                  active ? 'bg-brand-50 text-brand-700' : 'hover:bg-surface-muted',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
