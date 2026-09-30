'use client';

import type { CartView, CheckoutQuote, ShippingMethodView } from '@pe/shared';
import { formatPersianNumber, formatToman, toPersianDigits } from '@pe/shared';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AddressForm } from '@/components/account/address-form';
import { Price } from '@/components/catalog/price';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { t } from '@/i18n';
import { browserApi } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/error-message';
import type { Address } from '@/lib/types/address';
import { cn } from '@/lib/utils';
import { useCartStore } from '@/store/cart-store';

type Step = 'address' | 'shipping' | 'review';
const STEPS: Step[] = ['address', 'shipping', 'review'];

interface CheckoutFlowProps {
  initialCart: CartView;
  initialAddresses: Address[];
  /** Rendered in the review step once the quote is valid (payment step). */
  renderPlaceOrder?: (quote: CheckoutQuote) => ReactNode;
}

export function CheckoutFlow({
  initialCart,
  initialAddresses,
  renderPlaceOrder,
}: CheckoutFlowProps) {
  const cart = useCartStore((state) => state.cart) ?? initialCart;
  const setCart = useCartStore((state) => state.setCart);
  const [step, setStep] = useState<Step>('address');
  const [addresses, setAddresses] = useState(initialAddresses);
  const [addressId, setAddressId] = useState<string | undefined>(
    initialAddresses.find((a) => a.isDefault)?.id ?? initialAddresses[0]?.id,
  );
  const [addingAddress, setAddingAddress] = useState(initialAddresses.length === 0);
  const [methods, setMethods] = useState<ShippingMethodView[] | null>(null);
  const [methodCode, setMethodCode] = useState<string | undefined>();
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCart(initialCart);
  }, [initialCart, setCart]);

  const loadMethods = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await browserApi.get<ShippingMethodView[]>('/checkout/shipping-methods');
      setMethods(list);
      setMethodCode((current) => current ?? list[0]?.code);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadQuote = useCallback(async () => {
    if (!addressId || !methodCode) return;
    setLoading(true);
    setError(null);
    try {
      const result = await browserApi.post<CheckoutQuote>('/checkout/validate', {
        addressId,
        shippingMethodCode: methodCode,
      });
      setQuote(result);
      setCart(result.cart);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [addressId, methodCode, setCart]);

  const goTo = async (next: Step) => {
    setError(null);
    if (next === 'shipping' && !methods) await loadMethods();
    if (next === 'review') await loadQuote();
    setStep(next);
  };

  if (cart.items.length === 0 && step !== 'review') {
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
      <div className="flex flex-col gap-4">
        <Stepper current={step} />
        {error ? <Alert tone="error">{error}</Alert> : null}

        {step === 'address' ? (
          <Card>
            <h2 className="mb-4 text-lg font-bold">{t.checkout.selectAddress}</h2>
            {addresses.length === 0 && !addingAddress ? (
              <p className="mb-4 text-sm text-ink-muted">{t.checkout.noAddress}</p>
            ) : null}
            {!addingAddress ? (
              <ul className="flex flex-col gap-2">
                {addresses.map((address) => (
                  <li key={address.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition',
                        addressId === address.id
                          ? 'border-brand-600 bg-brand-50'
                          : 'border-border hover:border-brand-300',
                      )}
                    >
                      <input
                        type="radio"
                        name="address"
                        className="mt-1 accent-brand-600"
                        checked={addressId === address.id}
                        onChange={() => setAddressId(address.id)}
                      />
                      <span>
                        <span className="font-bold">{address.title}</span> — {address.recipientName}
                        <br />
                        <span className="text-ink-muted">
                          {address.province}، {address.city}، {address.addressLine}
                        </span>
                        <br />
                        <span className="text-xs text-ink-muted" dir="ltr">
                          {toPersianDigits(address.recipientPhone)} ·{' '}
                          {toPersianDigits(address.postalCode)}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : null}
            {addingAddress ? (
              <div className="mt-2">
                <AddressForm
                  onSaved={(saved) => {
                    setAddresses((list) => [
                      saved,
                      ...list.map((a) => (saved.isDefault ? { ...a, isDefault: false } : a)),
                    ]);
                    setAddressId(saved.id);
                    setAddingAddress(false);
                  }}
                  onCancel={() => setAddingAddress(false)}
                />
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setAddingAddress(true)}>
                  {t.checkout.addAddress}
                </Button>
                <Button
                  disabled={!addressId}
                  loading={loading}
                  onClick={() => void goTo('shipping')}
                >
                  {t.checkout.next}
                </Button>
              </div>
            )}
          </Card>
        ) : null}

        {step === 'shipping' ? (
          <Card>
            <h2 className="mb-4 text-lg font-bold">{t.checkout.selectShipping}</h2>
            {methods === null ? (
              <p className="text-sm text-ink-muted">{t.checkout.loading}</p>
            ) : methods.length === 0 ? (
              <Alert tone="warning">{t.checkout.noShipping}</Alert>
            ) : (
              <ul className="flex flex-col gap-2">
                {methods.map((method) => (
                  <li key={method.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition',
                        methodCode === method.code
                          ? 'border-brand-600 bg-brand-50'
                          : 'border-border hover:border-brand-300',
                      )}
                    >
                      <input
                        type="radio"
                        name="shipping"
                        className="accent-brand-600"
                        checked={methodCode === method.code}
                        onChange={() => setMethodCode(method.code)}
                      />
                      <span className="flex-1">
                        <span className="font-bold">{method.name}</span>
                        {method.description ? (
                          <span className="block text-xs text-ink-muted">{method.description}</span>
                        ) : null}
                        <span className="block text-xs text-ink-muted">
                          {method.estimatedDaysMax === 0
                            ? t.checkout.deliverySameDay
                            : t.checkout.deliveryEstimate(
                                formatPersianNumber(method.estimatedDaysMin),
                                formatPersianNumber(method.estimatedDaysMax),
                              )}
                          {method.freeAboveAmount !== null
                            ? ` · ${t.checkout.freeAbove(formatToman(method.freeAboveAmount))}`
                            : ''}
                        </span>
                      </span>
                      <span className="text-sm font-bold">
                        {method.fee === 0 ? (
                          t.checkout.free
                        ) : (
                          <Price amount={method.fee} size="sm" />
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStep('address')}>
                {t.checkout.back}
              </Button>
              <Button disabled={!methodCode} loading={loading} onClick={() => void goTo('review')}>
                {t.checkout.next}
              </Button>
            </div>
          </Card>
        ) : null}

        {step === 'review' ? (
          <Card>
            <h2 className="mb-4 text-lg font-bold">{t.checkout.reviewTitle}</h2>
            {quote ? (
              <div className="flex flex-col gap-4 text-sm">
                {quote.issues.length > 0 ? (
                  <Alert tone="error">
                    <p className="font-bold">{t.checkout.issues}</p>
                    <ul className="mt-1 list-disc ps-5">
                      {quote.issues.map((issue, index) => (
                        <li key={`${issue.code}-${index}`}>{issue.message}</li>
                      ))}
                    </ul>
                    <Link href="/cart" className="mt-2 inline-block font-bold underline">
                      {t.checkout.backToCart}
                    </Link>
                  </Alert>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-ink-muted">{t.checkout.deliverTo}</p>
                    <p className="font-bold">
                      {quote.address.recipientName} — {quote.address.title}
                    </p>
                    <p className="text-ink-muted">
                      {quote.address.province}، {quote.address.city}، {quote.address.addressLine}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-ink-muted">{t.checkout.shipVia}</p>
                    <p className="font-bold">{quote.shippingMethod.name}</p>
                    <p className="text-ink-muted">
                      {quote.shippingMethod.fee === 0 ? (
                        t.checkout.free
                      ) : (
                        <Price amount={quote.shippingMethod.fee} size="sm" />
                      )}
                    </p>
                  </div>
                </div>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {quote.cart.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 p-3">
                      <span className="min-w-0">
                        <span className="line-clamp-1">{item.productTitle}</span>
                        <span className="text-xs text-ink-muted">
                          {item.variantTitle ? `${item.variantTitle} · ` : ''}
                          {toPersianDigits(item.quantity)} عدد
                        </span>
                      </span>
                      <Price amount={item.lineTotal} size="sm" />
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setStep('shipping')}>
                    {t.checkout.back}
                  </Button>
                  {renderPlaceOrder && quote.canPlaceOrder ? renderPlaceOrder(quote) : null}
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">{t.checkout.loading}</p>
            )}
          </Card>
        ) : null}
      </div>

      <aside className="lg:sticky lg:top-32 lg:self-start">
        <Card className="flex flex-col gap-3 text-sm">
          <h2 className="text-lg font-bold">{t.cart.summary}</h2>
          <div className="flex justify-between">
            <span className="text-ink-muted">
              {t.cart.subtotal} ({t.cart.itemsCount(formatPersianNumber(cart.totals.itemCount))})
            </span>
            <Price amount={cart.totals.subtotal} size="sm" />
          </div>
          {cart.totals.discount > 0 ? (
            <div className="flex justify-between text-green-700">
              <span>{t.cart.discount}</span>
              <span>
                −<Price amount={cart.totals.discount} size="sm" className="text-green-700" />
              </span>
            </div>
          ) : null}
          <div className="flex justify-between">
            <span className="text-ink-muted">{t.checkout.shippingFee}</span>
            {quote ? (
              quote.totals.shippingFee === 0 ? (
                <span>{t.checkout.free}</span>
              ) : (
                <Price amount={quote.totals.shippingFee} size="sm" />
              )
            ) : (
              <span className="text-xs text-ink-muted">{t.cart.shippingAtCheckout}</span>
            )}
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
            <span>{t.checkout.grandTotal}</span>
            <Price amount={quote ? quote.totals.grandTotal : cart.totals.total} size="md" />
          </div>
        </Card>
      </aside>
    </div>
  );
}

function Stepper({ current }: { current: Step }) {
  const index = STEPS.indexOf(current);
  return (
    <ol className="flex items-center gap-2 text-xs sm:text-sm" aria-label={t.checkout.title}>
      {STEPS.map((step, i) => (
        <li key={step} className="flex items-center gap-2">
          <span
            aria-current={i === index ? 'step' : undefined}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1 font-medium',
              i === index
                ? 'bg-brand-600 text-white'
                : i < index
                  ? 'bg-brand-50 text-brand-700'
                  : 'bg-surface-muted text-ink-muted',
            )}
          >
            <span className="tabular-nums">{toPersianDigits(i + 1)}</span>
            {t.checkout.steps[step]}
          </span>
          {i < STEPS.length - 1 ? (
            <span aria-hidden="true" className="text-ink-muted">
              ‹
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
