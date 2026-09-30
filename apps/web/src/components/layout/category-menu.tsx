'use client';

import type { CategoryNode } from '@pe/shared';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

/** Desktop "all categories" mega menu: hover/focus opens, roving through roots. */
export function CategoryMenu({ categories }: { categories: CategoryNode[] }) {
  // Hover opens the panel; a click pins it open (keyboard/touch users).
  const [hoverOpen, setHoverOpen] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const open = hoverOpen || pinnedOpen;
  const setOpen = (value: boolean) => {
    setHoverOpen(value);
    setPinnedOpen(value);
  };
  const [activeId, setActiveId] = useState<string | undefined>(categories[0]?.id);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  if (categories.length === 0) return null;
  const active = categories.find((c) => c.id === activeId) ?? categories[0];

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => setHoverOpen(true)}
      onMouseLeave={() => setHoverOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setPinnedOpen((v) => !v)}
        className="flex items-center gap-1 font-bold text-ink hover:text-brand-700"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
        {t.catalog.allCategories}
      </button>
      {open && active ? (
        <div
          id={panelId}
          className="absolute start-0 top-full z-50 flex w-[min(56rem,90vw)] rounded-b-card border border-border bg-surface shadow-xl"
        >
          <ul className="w-56 shrink-0 border-e border-border py-2">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/categories/${category.slug}`}
                  onMouseEnter={() => setActiveId(category.id)}
                  onFocus={() => setActiveId(category.id)}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'block px-4 py-2 text-sm',
                    category.id === active.id
                      ? 'bg-brand-50 text-brand-700'
                      : 'hover:bg-surface-muted',
                  )}
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
          <div className="grid flex-1 grid-cols-2 gap-4 p-4 lg:grid-cols-3">
            {active.children.length === 0 ? (
              <Link
                href={`/categories/${active.slug}`}
                onClick={() => setOpen(false)}
                className="text-sm text-brand-700 hover:underline"
              >
                {t.catalog.seeAll} {active.name}
              </Link>
            ) : (
              active.children.map((child) => (
                <div key={child.id}>
                  <Link
                    href={`/categories/${child.slug}`}
                    onClick={() => setOpen(false)}
                    className="text-sm font-bold text-ink hover:text-brand-700"
                  >
                    {child.name}
                  </Link>
                  {child.children.length > 0 ? (
                    <ul className="mt-1 flex flex-col gap-1">
                      {child.children.map((leaf) => (
                        <li key={leaf.id}>
                          <Link
                            href={`/categories/${leaf.slug}`}
                            onClick={() => setOpen(false)}
                            className="text-xs text-ink-muted hover:text-brand-700"
                          >
                            {leaf.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
