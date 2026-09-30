'use client';

import { displayName, hasRole, toPersianDigits } from '@pe/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { t } from '@/i18n';
import { browserApi } from '@/lib/api/client';
import { canAccessAdmin } from '@/lib/admin/navigation';
import { useAuthStore } from '@/store/auth-store';
import { selectItemCount, useCartStore } from '@/store/cart-store';
import { selectWishlistCount, useWishlistStore } from '@/store/wishlist-store';

/**
 * Account, wishlist and cart entry points. Renders the login link for guests
 * and a dropdown menu (plus the wishlist shortcut) for signed-in users.
 */
export function HeaderActions() {
  const user = useAuthStore((state) => state.user);
  const itemCount = useCartStore(selectItemCount);
  const wishlistCount = useWishlistStore(selectWishlistCount);
  return (
    <div className="ms-auto flex items-center gap-2 sm:gap-3">
      {user ? (
        <>
          <UserMenu />
          <Link
            href="/account/wishlist"
            aria-label={t.nav.wishlist}
            className="relative hidden size-10 place-items-center rounded-lg border border-border transition hover:border-brand-400 hover:text-brand-700 sm:grid"
          >
            <HeartIcon />
            {wishlistCount > 0 ? (
              <span className="absolute -end-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-accent-500 px-1 text-[11px] font-bold text-white tabular-nums">
                {toPersianDigits(wishlistCount)}
              </span>
            ) : null}
          </Link>
        </>
      ) : (
        <Link
          href="/login"
          className="hidden items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:border-brand-400 hover:text-brand-700 sm:inline-flex"
        >
          <UserIcon />
          <span>
            {t.nav.login} / {t.nav.register}
          </span>
        </Link>
      )}
      <Link
        href="/cart"
        aria-label={t.nav.cart}
        className="relative grid size-10 place-items-center rounded-lg border border-border transition hover:border-brand-400 hover:text-brand-700"
      >
        <CartIcon />
        {itemCount > 0 ? (
          <span className="absolute -end-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-accent-500 px-1 text-[11px] font-bold text-white tabular-nums">
            {toPersianDigits(itemCount)}
          </span>
        ) : null}
      </Link>
    </div>
  );
}

function UserMenu() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!user) return null;

  const logout = async () => {
    try {
      await browserApi.post('/auth/logout', {});
    } finally {
      setUser(null);
      setOpen(false);
      router.push('/');
      router.refresh();
    }
  };

  const links: Array<{ href: string; label: string }> = [
    { href: '/account', label: t.account.profile },
    { href: '/account/orders', label: t.account.orders },
    { href: '/account/wishlist', label: t.account.wishlist },
    { href: '/account/reviews', label: t.account.reviews },
    { href: '/account/addresses', label: t.account.addresses },
    { href: '/account/security', label: t.account.security },
  ];
  if (canAccessAdmin(user)) {
    links.push({ href: '/admin', label: t.nav.admin });
  }
  if (hasRole(user, 'SELLER')) {
    links.push({ href: '/seller', label: t.nav.seller });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t.nav.userMenu}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 max-w-40 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium transition hover:border-brand-400 hover:text-brand-700"
      >
        <UserIcon />
        <span className="hidden truncate sm:inline">{displayName(user)}</span>
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute end-0 top-12 z-50 w-56 rounded-lg border border-border bg-surface p-1 shadow-lg"
        >
          <p className="truncate px-3 py-2 text-xs text-ink-muted">
            {t.auth.welcome(displayName(user))}
          </p>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm hover:bg-surface-muted"
            >
              {link.label}
            </Link>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={logout}
            className="block w-full rounded-md px-3 py-2 text-start text-sm text-accent-600 hover:bg-surface-muted"
          >
            {t.nav.logout}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function UserIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6" strokeLinecap="round" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.5 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.5 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.7a1 1 0 0 0 1-.8L21 8H7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9.5" cy="20" r="1.2" />
      <circle cx="17.5" cy="20" r="1.2" />
    </svg>
  );
}
