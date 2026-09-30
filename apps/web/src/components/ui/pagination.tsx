import { toPersianDigits, type PaginationMeta } from '@pe/shared';
import Link from 'next/link';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

interface PaginationProps {
  pagination: PaginationMeta;
  /** Builds the href for a page number (keeps other query params). */
  hrefFor: (page: number) => string;
}

function pageWindow(current: number, total: number): Array<number | 'gap'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result: Array<number | 'gap'> = [];
  let previous = 0;
  for (const page of sorted) {
    if (page - previous > 1) result.push('gap');
    result.push(page);
    previous = page;
  }
  return result;
}

/** Accessible, RTL-aware pagination rendered as links (works without JS). */
export function Pagination({ pagination, hrefFor }: PaginationProps) {
  const { page, totalPages } = pagination;
  if (totalPages <= 1) return null;
  const linkClass =
    'grid size-10 place-items-center rounded-lg border border-border bg-surface text-sm transition hover:border-brand-400 hover:text-brand-700';
  return (
    <nav aria-label={t.catalog.pagination} className="flex items-center justify-center gap-1">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={linkClass} aria-label={t.common.previous}>
          ‹
        </Link>
      ) : (
        <span className={cn(linkClass, 'opacity-40')}>‹</span>
      )}
      {pageWindow(page, totalPages).map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} className="px-1 text-ink-muted">
            …
          </span>
        ) : (
          <Link
            key={item}
            href={hrefFor(item)}
            aria-current={item === page ? 'page' : undefined}
            className={cn(
              linkClass,
              'tabular-nums',
              item === page && 'border-brand-600 bg-brand-600 text-white hover:text-white',
            )}
          >
            {toPersianDigits(item)}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={linkClass} aria-label={t.common.next}>
          ›
        </Link>
      ) : (
        <span className={cn(linkClass, 'opacity-40')}>›</span>
      )}
    </nav>
  );
}
