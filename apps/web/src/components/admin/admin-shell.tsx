'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId, useState, type ReactNode } from 'react';
import { t } from '@/i18n';
import { adminFa } from '@/i18n/admin-fa';
import type { AdminNavItem } from '@/lib/admin/navigation';
import { cn } from '@/lib/utils';

interface AdminShellProps {
  items: AdminNavItem[];
  children: ReactNode;
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Responsive admin layout: a persistent sidebar on large screens and a
 * collapsible drawer toggled by a button on small screens.
 */
export function AdminShell({ items, children }: AdminShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const navId = useId();
  // The drawer closes as soon as a destination is picked on mobile.
  const close = () => setOpen(false);

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <h2 className="text-base font-bold">{adminFa.title}</h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={navId}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium"
        >
          <MenuIcon />
          {open ? adminFa.nav.closeMenu : adminFa.nav.openMenu}
        </button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav
          id={navId}
          aria-label={adminFa.nav.label}
          className={cn(
            'rounded-card border border-border bg-surface p-2 lg:sticky lg:top-32 lg:block lg:self-start',
            open ? 'block' : 'hidden',
          )}
        >
          <p className="hidden px-3 py-2 text-xs font-bold text-ink-muted lg:block">
            {adminFa.title}
          </p>
          <ul className="flex flex-col gap-1">
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={close}
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
            <li className="mt-2 border-t border-border pt-2">
              <Link
                href="/"
                onClick={close}
                className="block rounded-lg px-3 py-2 text-sm text-ink-muted transition hover:bg-surface-muted"
              >
                {adminFa.nav.backToSite}
              </Link>
            </li>
          </ul>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
      <span className="sr-only">{t.app.name}</span>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}
