'use client';

import type { CartView } from '@pe/shared';
import { formatPersianNumber, toPersianDigits } from '@pe/shared';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { Price } from '@/components/catalog/price';
import { SellerLine } from '@/components/catalog/seller-line';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { t } from '@/i18n';
import { errorMessage } from '@/lib/api/error-message';
import { assetUrl } from '@/lib/assets';
import { useAuthStore } from '@/store/auth-store';
import { useCartStore } from '@/store/cart-store';
import { QuantityStepper } from './quantity-stepper';

export function CartPage({ initialCart }: { initialCart: CartView | null }) {
  const cart = useCartStore((state) => state.cart) ?? initialCart;
  const setCart = useCartStore((state) => state.setCart);
  const update = useCartStore((state) => state.update);
  const remove = useCartStore((state) => state.remove);
  const clear = useCartStore((state) => state.clear);
  const user = useAuthStore((state) => state.user);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (initialCart) setCart(initialCart);
  }, [initialCart, setCart]);

  const run = async (key: string, action: () => Promise<unknown>) => {
    setError(null);
    setBusy(key);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (!cart || cart.items.length === 0) {
    return (
      <Card className="py-16 text-center">
        <p className="text-ink-muted">{t.cart.empty}</p>
        <Link
          href="/products"
          className="mt-4 inline-flex rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700"
        >
          {t.cart.browse}
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="flex flex-col gap-3">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {cart.warnings.length > 0 ? (
          <Alert tone="warning">
            <p className="font-bold">{t.cart.warnings}</p>
            <ul className="mt-1 list-disc ps-5">
              {cart.warnings.map((warning, index) => (
                <li key={`${warning.code}-${warning.itemId ?? index}`}>{warning.message}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
        <ul className="flex flex-col gap-3">
          {cart.items.map((item) => {
            const image = assetUrl(item.image?.url);
            const sellable = item.inStock;
            return (
              <li key={item.id}>
                <Card className="flex gap-4 p-4">
                  <Link
                    href={`/products/${item.productSlug}`}
                    className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-surface-muted"
                  >
                    {image ? (
                      <Image
                        src={image}
                        alt={item.image?.alt ?? item.productTitle}
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    ) : null}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Link
                      href={`/products/${item.productSlug}`}
                      className="line-clamp-2 text-sm font-medium hover:text-brand-700"
                    >
                      {item.productTitle}
                    </Link>
                    {item.variantTitle ? (
                      <p className="text-xs text-ink-muted">{item.variantTitle}</p>
                    ) : null}
                    <p className="text-xs text-ink-muted" dir="ltr">
                      {item.sku}
                    </p>
                    <SellerLine seller={item.seller} />
                    {!sellable ? (
                      <p className="text-xs text-accent-600">
                        {item.availableQuantity === 0 ? t.cart.outOfStock : t.cart.unavailable}
                      </p>
                    ) : item.quantityExceedsStock ? (
                      <p className="text-xs text-accent-600">
                        {t.cart.onlyLeft(formatPersianNumber(item.availableQuantity))}
                      </p>
                    ) : item.priceChanged ? (
                      <p className="text-xs text-amber-700">{t.cart.priceChanged}</p>
                    ) : null}
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                      <QuantityStepper
                        value={item.quantity}
                        max={Math.min(item.availableQuantity, 10)}
                        disabled={busy === item.id}
                        onChange={(quantity) =>
                          run(item.id, () =>
                            quantity <= 0 ? remove(item.id) : update(item.id, quantity),
                          )
                        }
                      />
                      <div className="text-end">
                        <Price amount={item.lineTotal} size="md" />
                        {item.quantity > 1 ? (
                          <p className="text-xs text-ink-muted">
                            {toPersianDigits(item.quantity)} ×{' '}
                            <Price
                              amount={item.unitPrice}
                              compareAt={item.compareAtPrice}
                              size="sm"
                            />
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="text-accent-600"
            onClick={() => {
              if (window.confirm(t.cart.clearConfirm)) void run('clear', clear);
            }}
          >
            {t.cart.clear}
          </Button>
        </div>
      </section>

      <aside className="lg:sticky lg:top-32 lg:self-start">
        <Card className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">{t.cart.summary}</h2>
          <CouponForm cart={cart} onError={setError} />
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">
                {t.cart.subtotal} ({t.cart.itemsCount(formatPersianNumber(cart.totals.itemCount))})
              </dt>
              <dd>
                <Price amount={cart.totals.subtotal} size="sm" />
              </dd>
            </div>
            {cart.totals.discount > 0 ? (
              <div className="flex justify-between text-green-700">
                <dt>{t.cart.discount}</dt>
                <dd>
                  −<Price amount={cart.totals.discount} size="sm" className="text-green-700" />
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-ink-muted">{t.cart.shipping}</dt>
              <dd className="text-xs text-ink-muted">{t.cart.shippingAtCheckout}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
              <dt>{t.cart.total}</dt>
              <dd>
                <Price amount={cart.totals.total} size="md" />
              </dd>
            </div>
          </dl>
          {user ? (
            <Link
              href="/checkout"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-brand-600 text-base font-bold text-white transition hover:bg-brand-700"
            >
              {t.cart.checkout}
            </Link>
          ) : (
            <>
              <Link
                href="/login?next=/checkout"
                className="inline-flex h-12 items-center justify-center rounded-lg bg-brand-600 text-base font-bold text-white transition hover:bg-brand-700"
              >
                {t.cart.checkout}
              </Link>
              <p className="text-center text-xs text-ink-muted">{t.cart.loginToCheckout}</p>
            </>
          )}
        </Card>
      </aside>
    </div>
  );
}

function CouponForm({
  cart,
  onError,
}: {
  cart: CartView;
  onError: (message: string | null) => void;
}) {
  const applyCoupon = useCartStore((state) => state.applyCoupon);
  const removeCoupon = useCartStore((state) => state.removeCoupon);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    onError(null);
    try {
      await applyCoupon(code.trim());
      setCode('');
    } catch (error) {
      onError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  if (cart.coupon) {
    return (
      <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
        <span>{t.cart.couponApplied(cart.coupon.code)}</span>
        <button
          type="button"
          className="text-xs underline"
          onClick={() => void removeCoupon().catch((e: unknown) => onError(errorMessage(e)))}
        >
          {t.cart.removeCoupon}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <label className="sr-only" htmlFor="coupon-code">
        {t.cart.coupon}
      </label>
      <input
        id="coupon-code"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder={t.cart.couponPlaceholder}
        dir="ltr"
        className="h-10 min-w-0 flex-1 rounded-lg border border-border px-3 text-sm uppercase outline-none focus:border-brand-500"
      />
      <Button type="submit" size="sm" variant="outline" loading={loading} disabled={!code.trim()}>
        {t.cart.applyCoupon}
      </Button>
    </form>
  );
}
