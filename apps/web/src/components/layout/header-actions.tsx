import Link from 'next/link';
import { t } from '@/i18n';

/**
 * Account and cart entry points. Server rendered; auth-aware variants are
 * introduced with the authentication phase.
 */
export function HeaderActions() {
  return (
    <div className="ms-auto flex items-center gap-2 sm:gap-3">
      <Link
        href="/login"
        className="hidden items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:border-brand-400 hover:text-brand-700 sm:inline-flex"
      >
        <UserIcon />
        <span>
          {t.nav.login} / {t.nav.register}
        </span>
      </Link>
      <Link
        href="/cart"
        aria-label={t.nav.cart}
        className="relative grid size-10 place-items-center rounded-lg border border-border transition hover:border-brand-400 hover:text-brand-700"
      >
        <CartIcon />
      </Link>
    </div>
  );
}

function UserIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6" strokeLinecap="round" />
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
