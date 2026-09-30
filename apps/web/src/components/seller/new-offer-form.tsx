'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import {
  SEARCH_SUGGEST_MIN_LENGTH,
  formatPersianNumber,
  type ProductDetail,
  type SearchSuggestions,
  type SellerOfferView,
} from '@pe/shared';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Price } from '@/components/catalog/price';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { SelectField, TextField } from '@/components/ui/form-field';
import { t } from '@/i18n';
import { browserApi } from '@/lib/api/client';
import { assetUrl } from '@/lib/assets';
import { sellerErrorMessage } from '@/lib/seller/errors';
import { sellerOfferSchema, tomanToRials, type SellerOfferFormValues } from '@/lib/seller/schemas';

const copy = t.seller.newOffer;
const DEBOUNCE_MS = 250;

type SuggestedProduct = SearchSuggestions['products'][number];

/** Two-step flow: pick a catalogue product, then submit the seller's offer for it. */
export function NewOfferForm() {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [created, setCreated] = useState<SellerOfferView | null>(null);

  if (created) {
    return (
      <Card>
        <Alert tone="success">{copy.created}</Alert>
        <p className="mt-4 font-medium">{created.productTitle}</p>
        <p className="text-xs text-ink-muted" dir="ltr">
          {created.sku}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/seller/products"
            className="inline-flex h-11 items-center rounded-lg bg-brand-600 px-5 text-sm font-bold text-white hover:bg-brand-700"
          >
            {copy.goToProducts}
          </Link>
          <Button
            variant="outline"
            onClick={() => {
              setCreated(null);
              setProduct(null);
            }}
          >
            {copy.addAnother}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {product ? (
        <SelectedProduct product={product} onChange={() => setProduct(null)} />
      ) : (
        <ProductPicker onPick={setProduct} />
      )}
      {product ? <OfferFields product={product} onCreated={setCreated} /> : null}
    </div>
  );
}

function ProductPicker({ onPick }: { onPick: (product: ProductDetail) => void }) {
  const inputId = useId();
  const [query, setQuery] = useState('');
  // Last completed search; results are "current" once its query matches what is typed.
  const [completed, setCompleted] = useState<{ query: string; products: SuggestedProduct[] }>({
    query: '',
    products: [],
  });
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trimmed = query.trim();
  const canSearch = trimmed.length >= SEARCH_SUGGEST_MIN_LENGTH;
  const current = canSearch && completed.query === trimmed;
  const searching = canSearch && !current;
  const results = current ? completed.products : null;

  // Debounced suggestion fetch; stale responses are dropped via the abort signal.
  useEffect(() => {
    if (!canSearch) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      browserApi
        .get<SearchSuggestions>('/search/suggest', {
          query: { q: trimmed },
          signal: controller.signal,
        })
        .then((result) => {
          if (controller.signal.aborted) return;
          setCompleted({ query: trimmed, products: result.products });
        })
        .catch(() => {
          if (!controller.signal.aborted) setCompleted({ query: trimmed, products: [] });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [canSearch, trimmed]);

  const pick = async (item: SuggestedProduct) => {
    setError(null);
    setLoadingSlug(item.slug);
    try {
      const detail = await browserApi.get<ProductDetail>(
        `/products/${encodeURIComponent(item.slug)}`,
      );
      onPick(detail);
    } catch (err) {
      setError(sellerErrorMessage(err));
    } finally {
      setLoadingSlug(null);
    }
  };

  return (
    <Card>
      <CardTitle>{copy.title}</CardTitle>
      <p className="mb-4 text-sm text-ink-muted">{copy.intro}</p>
      {error ? (
        <Alert tone="error" className="mb-4">
          {error}
        </Alert>
      ) : null}
      <TextField
        id={inputId}
        label={copy.searchLabel}
        placeholder={copy.searchPlaceholder}
        type="search"
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {canSearch ? (
        <div className="mt-4" aria-live="polite">
          {searching ? (
            <p className="text-sm text-ink-muted">{copy.searching}</p>
          ) : results && results.length === 0 ? (
            <p className="text-sm text-ink-muted">{copy.noResults}</p>
          ) : results ? (
            <ul
              aria-label={copy.results}
              className="divide-y divide-border rounded-lg border border-border"
            >
              {results.map((item) => {
                const image = assetUrl(item.image?.url);
                return (
                  <li key={item.id} className="flex items-center gap-3 p-3 text-sm">
                    <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
                      {image ? (
                        <Image
                          src={image}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-medium">{item.title}</p>
                      <Price amount={item.price} size="sm" />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      loading={loadingSlug === item.slug}
                      disabled={loadingSlug !== null}
                      onClick={() => void pick(item)}
                    >
                      {copy.pick}
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function SelectedProduct({ product, onChange }: { product: ProductDetail; onChange: () => void }) {
  const image = assetUrl(product.images[0]?.url);
  const activeOffers = product.variants.filter((v) => v.status === 'ACTIVE').length;
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
          {image ? (
            <Image src={image} alt="" fill sizes="80px" className="object-cover" unoptimized />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-muted">{copy.selectedProduct}</p>
          <p className="font-bold">{product.title}</p>
          <p className="mt-1 text-xs text-ink-muted">
            {copy.currentOffers(formatPersianNumber(activeOffers))}
            {product.price !== null ? (
              <>
                {' · '}
                {copy.lowestPrice}: <Price amount={product.price} size="sm" />
              </>
            ) : null}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onChange}>
          {copy.change}
        </Button>
      </div>
    </Card>
  );
}

function OfferFields({
  product,
  onCreated,
}: {
  product: ProductDetail;
  onCreated: (offer: SellerOfferView) => void;
}) {
  const [attributeValues, setAttributeValues] = useState<Record<string, string>>({});
  const [attributeErrors, setAttributeErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SellerOfferFormValues>({
    resolver: yupResolver(sellerOfferSchema),
    defaultValues: { sku: '', title: '', initialStock: 0, lowStockThreshold: 5 },
  });

  const submit = handleSubmit(async (values) => {
    setError(null);
    const missing = Object.fromEntries(
      product.variantAttributes
        .filter((attribute) => !attributeValues[attribute.id])
        .map((attribute) => [attribute.id, t.seller.validation.attributeRequired]),
    );
    setAttributeErrors(missing);
    if (Object.keys(missing).length > 0) return;
    try {
      const offer = await browserApi.post<SellerOfferView>(
        `/seller/products/${encodeURIComponent(product.id)}/offers`,
        {
          sku: values.sku,
          price: tomanToRials(values.price),
          ...(values.compareAtPrice !== undefined
            ? { compareAtPrice: tomanToRials(values.compareAtPrice) }
            : {}),
          ...(values.title ? { title: values.title } : {}),
          initialStock: values.initialStock,
          lowStockThreshold: values.lowStockThreshold,
          ...(product.variantAttributes.length > 0
            ? {
                attributeValues: product.variantAttributes.map((attribute) => ({
                  attributeId: attribute.id,
                  valueId: attributeValues[attribute.id] ?? '',
                })),
              }
            : {}),
        },
      );
      onCreated(offer);
    } catch (err) {
      setError(sellerErrorMessage(err));
    }
  });

  return (
    <Card>
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        {error ? <Alert tone="error">{error}</Alert> : null}

        {product.variantAttributes.length > 0 ? (
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-1 text-base font-bold">{copy.attributes}</legend>
            <p className="text-xs text-ink-muted sm:col-span-2">{copy.attributesHint}</p>
            {product.variantAttributes.map((attribute) => (
              <SelectField
                key={attribute.id}
                label={attribute.name}
                placeholder={copy.selectValue}
                options={attribute.values.map((value) => ({ value: value.id, label: value.value }))}
                value={attributeValues[attribute.id] ?? ''}
                error={attributeErrors[attribute.id]}
                onChange={(event) => {
                  const valueId = event.target.value;
                  setAttributeValues((current) => ({ ...current, [attribute.id]: valueId }));
                  setAttributeErrors((current) => {
                    const next = { ...current };
                    delete next[attribute.id];
                    return next;
                  });
                }}
              />
            ))}
          </fieldset>
        ) : null}

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-1 text-base font-bold">{t.seller.offers.title}</legend>
          <TextField
            label={copy.sku}
            dir="ltr"
            className="text-left font-mono"
            hint={copy.skuHint}
            autoComplete="off"
            error={errors.sku?.message}
            {...register('sku')}
          />
          <TextField
            label={t.seller.offers.fields.title}
            optional
            error={errors.title?.message}
            {...register('title')}
          />
          <TextField
            label={t.seller.offers.fields.price}
            inputMode="numeric"
            dir="ltr"
            className="text-left"
            error={errors.price?.message}
            {...register('price')}
          />
          <TextField
            label={t.seller.offers.fields.compareAtPrice}
            optional
            inputMode="numeric"
            dir="ltr"
            className="text-left"
            error={errors.compareAtPrice?.message}
            {...register('compareAtPrice')}
          />
          <TextField
            label={copy.initialStock}
            inputMode="numeric"
            dir="ltr"
            className="text-left"
            error={errors.initialStock?.message}
            {...register('initialStock')}
          />
          <TextField
            label={copy.lowStockThreshold}
            inputMode="numeric"
            dir="ltr"
            className="text-left"
            error={errors.lowStockThreshold?.message}
            {...register('lowStockThreshold')}
          />
        </fieldset>

        <div>
          <Button type="submit" loading={isSubmitting}>
            {copy.submit}
          </Button>
        </div>
      </form>
    </Card>
  );
}
