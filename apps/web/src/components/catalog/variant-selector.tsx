'use client';

import type { ProductDetail, VariantDetail } from '@pe/shared';
import { useMemo, useState } from 'react';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { Price } from './price';

export interface VariantSelectorProps {
  product: ProductDetail;
  /** Renders below the price; receives the currently selected variant (or null). */
  renderActions?: (variant: VariantDetail | null) => React.ReactNode;
  onVariantChange?: (variant: VariantDetail | null) => void;
}

function matches(variant: VariantDetail, selection: Record<string, string>): boolean {
  return Object.entries(selection).every(([attributeId, valueId]) =>
    variant.attributes.some((a) => a.attributeId === attributeId && a.valueId === valueId),
  );
}

/** Picks the variant customers should see first: cheapest in-stock, else default/first. */
export function initialVariant(variants: VariantDetail[]): VariantDetail | null {
  const inStock = variants.filter((v) => v.inStock).sort((a, b) => a.price - b.price);
  return inStock[0] ?? variants.find((v) => v.isDefault) ?? variants[0] ?? null;
}

export function VariantSelector({ product, renderActions, onVariantChange }: VariantSelectorProps) {
  const first = useMemo(() => initialVariant(product.variants), [product.variants]);
  const [selection, setSelection] = useState<Record<string, string>>(() =>
    Object.fromEntries((first?.attributes ?? []).map((a) => [a.attributeId, a.valueId])),
  );

  const selected = useMemo(() => {
    const complete = product.variantAttributes.every((a) => selection[a.id]);
    if (!complete) return null;
    return product.variants.find((v) => matches(v, selection)) ?? null;
  }, [product, selection]);

  const choose = (attributeId: string, valueId: string) => {
    const desired = { ...selection, [attributeId]: valueId };
    // Keep the exact combination when it exists; otherwise jump to the best
    // variant carrying the chosen value (cheapest in stock, then any).
    const exact = product.variants.find((v) => matches(v, desired));
    const fallback = product.variants
      .filter((v) =>
        v.attributes.some((a) => a.attributeId === attributeId && a.valueId === valueId),
      )
      .sort((a, b) => Number(b.inStock) - Number(a.inStock) || a.price - b.price)[0];
    const target = exact ?? fallback ?? null;
    const next = target
      ? Object.fromEntries(target.attributes.map((a) => [a.attributeId, a.valueId]))
      : desired;
    setSelection(next);
    onVariantChange?.(target);
  };

  const isValueAvailable = (attributeId: string, valueId: string): boolean => {
    const partial = { ...selection, [attributeId]: valueId };
    // Compatible when at least one variant matches the constraints excluding conflicting ones.
    return product.variants.some(
      (v) =>
        v.attributes.some((a) => a.attributeId === attributeId && a.valueId === valueId) &&
        matchesOthers(v, partial, attributeId),
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {product.variantAttributes.map((attribute) => (
        <fieldset key={attribute.id}>
          <legend className="mb-2 text-sm font-bold">
            {t.catalog.selectVariant} {attribute.name}
          </legend>
          <div className="flex flex-wrap gap-2">
            {attribute.values.map((value) => {
              const active = selection[attribute.id] === value.id;
              const available = isValueAvailable(attribute.id, value.id);
              const inStockSomewhere = product.variants.some(
                (v) => v.inStock && v.attributes.some((a) => a.valueId === value.id),
              );
              return (
                <button
                  key={value.id}
                  type="button"
                  onClick={() => choose(attribute.id, value.id)}
                  aria-pressed={active}
                  title={value.value}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition',
                    active
                      ? 'border-brand-600 bg-brand-50 text-brand-800'
                      : 'border-border bg-surface hover:border-brand-300',
                    !available && 'opacity-40',
                    !inStockSomewhere && 'line-through',
                  )}
                >
                  {value.colorHex ? (
                    <span
                      aria-hidden="true"
                      className="inline-block size-4 rounded-full border border-border"
                      style={{ backgroundColor: value.colorHex }}
                    />
                  ) : null}
                  {value.value}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="rounded-card border border-border bg-surface p-4">
        {selected ? (
          <>
            <Price
              amount={selected.price}
              compareAt={selected.compareAtPrice}
              discountPercent={selected.discountPercent}
              size="lg"
            />
            <p
              className={cn(
                'mt-2 text-sm',
                selected.inStock ? 'text-green-700' : 'text-accent-600',
              )}
            >
              {selected.inStock
                ? selected.lowStock
                  ? t.catalog.lowStock(selected.availableQuantity)
                  : t.catalog.inStock
                : t.catalog.outOfStock}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {t.catalog.sku}: <span dir="ltr">{selected.sku}</span>
            </p>
          </>
        ) : (
          <p className="text-sm text-ink-muted">
            {product.variantAttributes.length
              ? t.catalog.selectOptionsFirst
              : t.catalog.variantUnavailable}
          </p>
        )}
        {renderActions ? <div className="mt-4">{renderActions(selected)}</div> : null}
      </div>
    </div>
  );
}

function matchesOthers(
  variant: VariantDetail,
  selection: Record<string, string>,
  except: string,
): boolean {
  return Object.entries(selection).every(([attributeId, valueId]) => {
    if (attributeId === except) return true;
    return variant.attributes.some((a) => a.attributeId === attributeId && a.valueId === valueId);
  });
}
