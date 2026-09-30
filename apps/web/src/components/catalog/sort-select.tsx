'use client';

import { ProductSortOptions } from '@pe/shared';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useId } from 'react';
import { t } from '@/i18n';

export function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const id = useId();
  const current = params.get('sort') ?? 'newest';
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <span className="text-ink-muted">{t.catalog.sort}:</span>
      <select
        id={id}
        value={current}
        onChange={(event) => {
          const next = new URLSearchParams(params.toString());
          next.set('sort', event.target.value);
          next.delete('page');
          router.push(`${pathname}?${next.toString()}`);
        }}
        className="h-9 rounded-lg border border-border bg-surface px-2 text-sm"
      >
        {ProductSortOptions.map((option) => (
          <option key={option} value={option}>
            {t.catalog.sortOptions[option]}
          </option>
        ))}
      </select>
    </label>
  );
}
