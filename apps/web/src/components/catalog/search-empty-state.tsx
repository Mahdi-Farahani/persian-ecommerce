import Link from 'next/link';
import { t } from '@/i18n';
import { searchHref } from '@/lib/catalog/listing';

const linkClass =
  'inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium transition hover:border-brand-400 hover:text-brand-700';

/** Shown when a query returns nothing; nudges the visitor toward a broader search. */
export function SearchEmptyState({ query, filtered }: { query: string; filtered: boolean }) {
  return (
    <div className="rounded-card border border-dashed border-border bg-surface p-8 text-center">
      <p className="text-base font-bold">{t.search.emptyTitle(query)}</p>
      <p className="mt-4 text-sm text-ink-muted">{t.search.emptyHint}</p>
      <ul className="mx-auto mt-2 max-w-md list-disc space-y-1 ps-5 text-start text-sm text-ink-muted">
        {t.search.tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {filtered ? (
          <Link href={searchHref(query)} className={linkClass}>
            {t.search.removeFilters}
          </Link>
        ) : null}
        <Link href="/categories" className={linkClass}>
          {t.search.browseCategories}
        </Link>
        <Link href="/products" className={linkClass}>
          {t.search.allProducts}
        </Link>
      </div>
    </div>
  );
}

/** Shown when the search page is opened without a query. */
export function SearchPrompt() {
  return (
    <div className="rounded-card border border-dashed border-border bg-surface p-10 text-center">
      <h1 className="text-xl font-bold">{t.search.promptTitle}</h1>
      <p className="mt-2 text-sm text-ink-muted">{t.search.promptBody}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/categories" className={linkClass}>
          {t.search.browseCategories}
        </Link>
        <Link href="/products" className={linkClass}>
          {t.search.allProducts}
        </Link>
      </div>
    </div>
  );
}
