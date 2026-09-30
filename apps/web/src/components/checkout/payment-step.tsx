'use client';

import type {
  CheckoutQuote,
  CreatePaymentResponse,
  OrderDetail,
  PaymentProviderInfo,
  PaymentProviderName,
} from '@pe/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextAreaField } from '@/components/ui/form-field';
import { useToast } from '@/components/ui/toast';
import { t } from '@/i18n';
import { browserApi } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/error-message';
import { redirectToGateway } from '@/lib/payments/redirect';
import { cn } from '@/lib/utils';
import { useCartStore } from '@/store/cart-store';

interface PaymentStepProps {
  quote: CheckoutQuote;
  /** Rendered next to the submit button (e.g. the "back" button). */
  actions?: ReactNode;
}

const NOTE_MAX_LENGTH = 500;

/**
 * Final checkout step: pick a payment gateway, create the order and hand the
 * browser to the gateway. When the order was created but the payment could
 * not be started, the customer lands on the order page to retry from there.
 */
export function PaymentStep({ quote, actions }: PaymentStepProps) {
  const router = useRouter();
  const { notify } = useToast();
  const [providers, setProviders] = useState<PaymentProviderInfo[] | null>(null);
  const [provider, setProvider] = useState<PaymentProviderName | undefined>();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    browserApi
      .get<PaymentProviderInfo[]>('/payments/providers')
      .then((list) => {
        if (cancelled) return;
        setProviders(list);
        setProvider((list.find((p) => p.isDefault) ?? list[0])?.provider);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setProviders([]);
        setLoadError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const placeOrder = async () => {
    if (!provider) return;
    setSubmitting(true);
    setError(null);
    let order: OrderDetail;
    try {
      order = await browserApi.post<OrderDetail>('/checkout', {
        addressId: quote.address.id,
        shippingMethodCode: quote.shippingMethod.code,
        note: note.trim() || undefined,
      });
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
      return;
    }
    // The server cart is consumed by the order; drop the local mirror.
    useCartStore.getState().setCart(null);
    try {
      const payment = await browserApi.post<CreatePaymentResponse>('/payments', {
        orderId: order.id,
        provider,
      });
      redirectToGateway(payment);
    } catch (err) {
      notify(errorMessage(err, t.checkout.orderCreatedPaymentFailed), { tone: 'error' });
      router.push(`/account/orders/${order.id}`);
    }
  };

  const disabled = !provider || providers === null || providers.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-base font-bold">{t.checkout.paymentMethod}</legend>
        {providers === null ? (
          <p className="text-sm text-ink-muted">{t.checkout.loadingProviders}</p>
        ) : providers.length === 0 ? (
          <Alert tone="warning">{loadError ?? t.checkout.noProviders}</Alert>
        ) : (
          <ul className="flex flex-col gap-2">
            {providers.map((item) => (
              <li key={item.provider}>
                <label
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition',
                    provider === item.provider
                      ? 'border-brand-600 bg-brand-50'
                      : 'border-border hover:border-brand-300',
                  )}
                >
                  <input
                    type="radio"
                    name="payment-provider"
                    className="mt-1 accent-brand-600"
                    value={item.provider}
                    checked={provider === item.provider}
                    onChange={() => setProvider(item.provider)}
                  />
                  <span className="flex-1">
                    <span className="font-bold">
                      {item.displayName}
                      {item.environment === 'SANDBOX' ? (
                        <span className="ms-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-normal text-amber-700">
                          {t.checkout.sandboxProvider}
                        </span>
                      ) : null}
                    </span>
                    {item.description ? (
                      <span className="block text-xs text-ink-muted">{item.description}</span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <TextAreaField
        label={t.checkout.note}
        optional
        placeholder={t.checkout.notePlaceholder}
        maxLength={NOTE_MAX_LENGTH}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        className="min-h-20"
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        {actions}
        <Button disabled={disabled} loading={submitting} onClick={() => void placeOrder()}>
          {submitting ? t.checkout.redirecting : t.checkout.placeOrderAndPay}
        </Button>
      </div>
    </div>
  );
}
