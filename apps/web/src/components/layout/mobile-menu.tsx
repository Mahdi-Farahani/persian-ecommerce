'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { t } from '@/i18n';

interface MobileMenuProps {
  items: ReadonlyArray<{ href: string; label: string }>;
}

/**
 * Off-canvas navigation for small screens. Client component because it owns
 * open/closed state and listens for the Escape key.
 */
export function MobileMenu({ items }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? t.nav.closeMenu : t.nav.menu}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="grid size-10 place-items-center rounded-lg border border-border"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          {open ? (
            <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          )}
        </svg>
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label={t.nav.closeMenu}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <nav
            id={panelId}
            aria-label={t.nav.menu}
            className="relative ms-0 flex h-full w-72 max-w-[85vw] flex-col gap-1 bg-surface p-4 shadow-xl"
          >
            <p className="mb-2 text-lg font-bold text-brand-700">{t.app.name}</p>
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-base font-medium hover:bg-surface-muted"
              >
                {item.label}
              </Link>
            ))}
            <hr className="my-2 border-border" />
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 hover:bg-surface-muted"
            >
              {t.nav.login} / {t.nav.register}
            </Link>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
