'use client';

import type { BrandSummary, FilterableAttribute } from '@pe/shared';
import { formatPersianNumber, toEnglishDigits, toPersianDigits } from '@pe/shared';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

interface FilterSidebarProps {
  brands: BrandSummary[];
  attributes: FilterableAttribute[];
}

const RIALS_PER_TOMAN = 10;

/**
 * Filter panel driven entirely by URL search params so results are shareable
 * and server-rendered. Works as a plain form; JS only adds the drawer UX.
 */
export function FilterSidebar({ brands, attributes }: FilterSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const formId = useId();

  const selectedBrands = new Set((params.get('brand') ?? '').split(',').filter(Boolean));
  const selectedAttr = (slug: string) =>
    new Set((params.get(`attr[${slug}]`) ?? '').split(',').filter(Boolean));
  const minToman = params.get('minPrice') ? Number(params.get('minPrice')) / RIALS_PER_TOMAN : '';
  const maxToman = params.get('maxPrice') ? Number(params.get('maxPrice')) / RIALS_PER_TOMAN : '';
  const activeCount =
    selectedBrands.size +
    attributes.reduce((sum, a) => sum + selectedAttr(a.slug).size, 0) +
    (params.get('inStock') ? 1 : 0) +
    (params.get('minPrice') || params.get('maxPrice') ? 1 : 0);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    const keep = ['q', 'sort', 'limit'];
    for (const key of keep) {
      const value = params.get(key);
      if (value) next.set(key, value);
    }
    const brandValues = data.getAll('brand').map(String);
    if (brandValues.length) next.set('brand', brandValues.join(','));
    for (const attribute of attributes) {
      const values = data.getAll(`attr:${attribute.slug}`).map(String);
      if (values.length) next.set(`attr[${attribute.slug}]`, values.join(','));
    }
    const min = toEnglishDigits(String(data.get('minPrice') ?? '')).replace(/\D/g, '');
    const max = toEnglishDigits(String(data.get('maxPrice') ?? '')).replace(/\D/g, '');
    if (min) next.set('minPrice', String(Number(min) * RIALS_PER_TOMAN));
    if (max) next.set('maxPrice', String(Number(max) * RIALS_PER_TOMAN));
    if (data.get('inStock')) next.set('inStock', 'true');
    router.push(`${pathname}?${next.toString()}`);
    setOpen(false);
  };

  const clear = () => {
    const next = new URLSearchParams();
    for (const key of ['q', 'sort']) {
      const value = params.get(key);
      if (value) next.set(key, value);
    }
    router.push(next.size ? `${pathname}?${next.toString()}` : pathname);
    setOpen(false);
  };

  const panel = (
    <form id={formId} onSubmit={onSubmit} className="flex flex-col gap-5 text-sm">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-bold">{t.catalog.priceRange}</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            {t.catalog.minPrice} ({t.common.toman})
            <input
              name="minPrice"
              inputMode="numeric"
              defaultValue={minToman === '' ? '' : formatPersianNumber(Number(minToman))}
              className="h-10 rounded-lg border border-border bg-surface px-2 text-sm text-ink tabular-nums"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            {t.catalog.maxPrice} ({t.common.toman})
            <input
              name="maxPrice"
              inputMode="numeric"
              defaultValue={maxToman === '' ? '' : formatPersianNumber(Number(maxToman))}
              className="h-10 rounded-lg border border-border bg-surface px-2 text-sm text-ink tabular-nums"
            />
          </label>
        </div>
      </fieldset>

      <label className="flex items-center gap-2 font-medium">
        <input
          type="checkbox"
          name="inStock"
          defaultChecked={params.get('inStock') === 'true'}
          className="size-4 accent-brand-600"
        />
        {t.catalog.onlyInStock}
      </label>

      {brands.length > 0 ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-2 font-bold">{t.catalog.brand}</legend>
          <div className="max-h-48 overflow-y-auto pe-1">
            {brands.map((brand) => (
              <label key={brand.id} className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  name="brand"
                  value={brand.slug}
                  defaultChecked={selectedBrands.has(brand.slug)}
                  className="size-4 accent-brand-600"
                />
                <span>{brand.name}</span>
                {brand.nameEn ? (
                  <span className="text-xs text-ink-muted">{brand.nameEn}</span>
                ) : null}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {attributes
        .filter((a) => a.values.length > 0)
        .map((attribute) => {
          const selected = selectedAttr(attribute.slug);
          return (
            <fieldset key={attribute.id} className="flex flex-col gap-1">
              <legend className="mb-2 font-bold">{attribute.name}</legend>
              <div className="max-h-48 overflow-y-auto pe-1">
                {attribute.values.map((value) => (
                  <label key={value.id} className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      name={`attr:${attribute.slug}`}
                      value={value.slug}
                      defaultChecked={selected.has(value.slug)}
                      className="size-4 accent-brand-600"
                    />
                    {value.colorHex ? (
                      <span
                        aria-hidden="true"
                        className="inline-block size-4 rounded-full border border-border"
                        style={{ backgroundColor: value.colorHex }}
                      />
                    ) : null}
                    <span>{value.value}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}

      <div className="flex gap-2">
        <Button type="submit" size="sm">
          {t.catalog.applyFilters}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={clear}>
          {t.catalog.clearFilters}
        </Button>
      </div>
    </form>
  );

  return (
    <>
      <div className="lg:hidden">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          aria-expanded={open}
        >
          {t.catalog.filters}
          {activeCount > 0 ? (
            <span className="rounded-full bg-brand-600 px-1.5 text-xs text-white">
              {toPersianDigits(activeCount)}
            </span>
          ) : null}
        </Button>
        {open ? (
          <div className="fixed inset-0 z-50 flex">
            <button
              type="button"
              aria-label={t.common.close}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/40"
            />
            <div className="relative ms-auto flex h-full w-80 max-w-[90vw] flex-col overflow-y-auto bg-surface p-4 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-bold">{t.catalog.filters}</h2>
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  {t.common.close}
                </Button>
              </div>
              {panel}
            </div>
          </div>
        ) : null}
      </div>
      <aside
        className={cn('hidden rounded-card border border-border bg-surface p-4 lg:block')}
        aria-label={t.catalog.filters}
      >
        <h2 className="mb-4 font-bold">{t.catalog.filters}</h2>
        {panel}
      </aside>
    </>
  );
}
