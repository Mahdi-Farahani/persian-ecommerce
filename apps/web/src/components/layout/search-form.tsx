import { t } from '@/i18n';

/**
 * Plain HTML form so search works without JavaScript; submits to /search?q=.
 */
export function SearchForm() {
  return (
    <form action="/search" method="get" role="search" className="relative w-full">
      <label htmlFor="site-search" className="sr-only">
        {t.nav.search}
      </label>
      <input
        id="site-search"
        type="search"
        name="q"
        placeholder={t.nav.searchPlaceholder}
        autoComplete="off"
        className="h-10 w-full rounded-lg border border-border bg-surface-muted ps-4 pe-10 text-sm outline-none transition focus:border-brand-400 focus:bg-surface"
      />
      <button
        type="submit"
        aria-label={t.nav.search}
        className="absolute inset-y-0 end-0 grid w-10 place-items-center text-ink-muted hover:text-brand-700"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
      </button>
    </form>
  );
}
