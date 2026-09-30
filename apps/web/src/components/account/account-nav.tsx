'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

const items = [
  { href: '/account', label: t.account.profile },
  { href: '/account/orders', label: t.account.orders },
  { href: '/account/addresses', label: t.account.addresses },
  { href: '/account/security', label: t.account.security },
] as const;

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label={t.account.title}
      className="rounded-card border border-border bg-surface p-2 lg:sticky lg:top-32 lg:self-start"
    >
      <ul className="flex gap-1 overflow-x-auto lg:flex-col">
        {items.map((item) => {
          const active =
            item.href === '/account'
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
