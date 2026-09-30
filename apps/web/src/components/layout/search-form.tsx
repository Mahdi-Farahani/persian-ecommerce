'use client';

import { SEARCH_SUGGEST_MIN_LENGTH, formatToman, type SearchSuggestions } from '@pe/shared';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { t } from '@/i18n';
import { browserApi } from '@/lib/api/client';
import { assetUrl } from '@/lib/assets';
import { searchHref } from '@/lib/catalog/listing';
import { cn } from '@/lib/utils';

const DEBOUNCE_MS = 250;

type SuggestionKind = 'product' | 'category' | 'brand' | 'all';

interface Option {
  id: string;
  kind: SuggestionKind;
  href: string;
  label: string;
  /** Extra line under the label (price or stock state) for products. */
  meta?: string;
  image?: string | null;
}

const EMPTY: SearchSuggestions = { query: '', products: [], categories: [], brands: [] };

function toOptions(suggestions: SearchSuggestions, query: string): Option[] {
  const options: Option[] = suggestions.products.map((product) => ({
    id: `product-${product.id}`,
    kind: 'product',
    href: `/products/${product.slug}`,
    label: product.title,
    meta: !product.inStock
      ? t.catalog.outOfStock
      : product.price === null
        ? t.catalog.unavailable
        : formatToman(product.price),
    image: assetUrl(product.image?.url),
  }));
  for (const category of suggestions.categories) {
    options.push({
      id: `category-${category.id}`,
      kind: 'category',
      href: `/categories/${category.slug}`,
      label: category.name,
    });
  }
  for (const brand of suggestions.brands) {
    options.push({
      id: `brand-${brand.id}`,
      kind: 'brand',
      href: `/brands/${brand.slug}`,
      label: brand.name,
    });
  }
  if (options.length > 0) {
    options.push({
      id: 'all',
      kind: 'all',
      href: searchHref(query),
      label: t.search.viewAll(query),
    });
  }
  return options;
}

const groupLabels: Record<SuggestionKind, string | null> = {
  product: t.search.products,
  category: t.search.categories,
  brand: t.search.brands,
  all: null,
};

/**
 * Header search box with autocomplete. Stays a plain GET form to `/search`
 * so it works without JavaScript; the dropdown follows the ARIA combobox
 * pattern (listbox popup, arrow-key navigation, Enter/Escape).
 */
export function SearchForm() {
  const router = useRouter();
  const pathname = usePathname();
  const inputId = useId();
  const listboxId = useId();
  const rootRef = useRef<HTMLFormElement>(null);
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestions>(EMPTY);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Close the popup when a navigation completes (state adjusted during render).
  const [seenPathname, setSeenPathname] = useState(pathname);
  if (seenPathname !== pathname) {
    setSeenPathname(pathname);
    setOpen(false);
  }

  const query = value.trim();
  const canSuggest = query.length >= SEARCH_SUGGEST_MIN_LENGTH;
  // Suggestions are "current" once the stored result matches what is typed.
  const current = canSuggest && suggestions.query === query;
  const pending = canSuggest && !current;
  const options = useMemo(
    () => (current ? toOptions(suggestions, query) : []),
    [current, suggestions, query],
  );
  const expanded = open && canSuggest;

  // Debounced suggestion fetch; stale responses are dropped via the abort signal.
  useEffect(() => {
    if (!canSuggest) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      browserApi
        .get<SearchSuggestions>('/search/suggest', {
          query: { q: query },
          signal: controller.signal,
        })
        .then((result) => {
          if (controller.signal.aborted) return;
          setSuggestions({ ...result, query });
          setActiveIndex(-1);
        })
        .catch(() => {
          if (!controller.signal.aborted) setSuggestions({ ...EMPTY, query });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [canSuggest, query]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query) return;
    close();
    router.push(searchHref(query));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        if (options.length === 0) return;
        event.preventDefault();
        setOpen(true);
        setActiveIndex((index) => (index + 1) % options.length);
        break;
      case 'ArrowUp':
        if (options.length === 0) return;
        event.preventDefault();
        setOpen(true);
        setActiveIndex((index) => (index <= 0 ? options.length - 1 : index - 1));
        break;
      case 'Enter': {
        const active = expanded && activeIndex >= 0 ? options[activeIndex] : undefined;
        if (!active) return; // Falls through to the form submit.
        event.preventDefault();
        close();
        router.push(active.href);
        break;
      }
      case 'Escape':
        if (!open) return;
        event.preventDefault();
        close();
        break;
      default:
        break;
    }
  };

  const activeOption = activeIndex >= 0 ? options[activeIndex] : undefined;

  return (
    <form
      ref={rootRef}
      action="/search"
      method="get"
      role="search"
      onSubmit={submit}
      className="relative w-full"
    >
      <label htmlFor={inputId} className="sr-only">
        {t.nav.search}
      </label>
      <input
        id={inputId}
        type="search"
        name="q"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={t.nav.searchPlaceholder}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listboxId}
        aria-activedescendant={expanded && activeOption ? activeOption.id : undefined}
        aria-busy={pending || undefined}
        className="h-10 w-full rounded-lg border border-border bg-surface-muted ps-4 pe-10 text-sm outline-none transition focus:border-brand-400 focus:bg-surface"
      />
      <button
        type="submit"
        aria-label={t.nav.search}
        className="absolute inset-y-0 end-0 grid w-10 place-items-center text-ink-muted hover:text-brand-700"
      >
        <SearchIcon />
      </button>
      {expanded ? (
        <div className="absolute inset-x-0 top-11 z-50 max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-surface p-1 text-sm shadow-lg">
          <ul id={listboxId} role="listbox" aria-label={t.search.suggestions}>
            {options.length === 0 ? (
              <li role="presentation" className="px-3 py-2 text-ink-muted">
                {pending ? t.search.loading : t.search.noSuggestions}
              </li>
            ) : (
              options.map((option, index) => {
                const heading =
                  groupLabels[option.kind] && options[index - 1]?.kind !== option.kind
                    ? groupLabels[option.kind]
                    : null;
                return (
                  <SuggestionRow
                    key={option.id}
                    option={option}
                    heading={heading}
                    active={index === activeIndex}
                    onHover={() => setActiveIndex(index)}
                    onPick={close}
                  />
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </form>
  );
}

function SuggestionRow({
  option,
  heading,
  active,
  onHover,
  onPick,
}: {
  option: Option;
  heading: string | null;
  active: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  return (
    <>
      {heading ? (
        <li role="presentation" className="px-3 pt-2 pb-1 text-xs font-bold text-ink-muted">
          {heading}
        </li>
      ) : null}
      <li
        id={option.id}
        role="option"
        aria-selected={active}
        onMouseEnter={onHover}
        className={cn(
          'rounded-md',
          active && 'bg-surface-muted',
          option.kind === 'all' && 'mt-1 border-t border-border pt-1',
        )}
      >
        <Link
          href={option.href}
          tabIndex={-1}
          onClick={onPick}
          className={cn(
            'flex items-center gap-3 px-3 py-2 hover:bg-surface-muted',
            option.kind === 'all' && 'justify-center font-medium text-brand-700',
          )}
        >
          {option.kind === 'product' ? (
            <span className="relative size-10 shrink-0 overflow-hidden rounded-md border border-border bg-surface-muted">
              {option.image ? (
                <Image src={option.image} alt="" fill sizes="40px" className="object-cover" />
              ) : null}
            </span>
          ) : null}
          <span className="min-w-0 flex-1">
            <span className="block truncate">{option.label}</span>
            {option.meta ? (
              <span className="block text-xs text-ink-muted tabular-nums">{option.meta}</span>
            ) : null}
          </span>
        </Link>
      </li>
    </>
  );
}

function SearchIcon() {
  return (
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
  );
}
