'use client';

import type { CreatePaymentResponse, PaymentProviderName } from '@pe/shared';
import { useState } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { t } from '@/i18n';
import { browserApi } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/error-message';
import { redirectToGateway } from '@/lib/payments/redirect';

interface PayOrderButtonProps extends Omit<
  ButtonProps,
  'onClick' | 'onError' | 'children' | 'loading'
> {
  orderId: string;
  /** Provider of a previous attempt; omitted to let the API pick the default. */
  provider?: PaymentProviderName;
  label?: string;
  /** When given, failures are reported here instead of rendered inline. */
  onPaymentError?: (message: string) => void;
}

/** Starts a (new) payment for an order and sends the browser to the gateway. */
export function PayOrderButton({
  orderId,
  provider,
  label,
  onPaymentError,
  ...rest
}: PayOrderButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await browserApi.post<CreatePaymentResponse>('/payments', {
        orderId,
        provider,
      });
      redirectToGateway(response);
    } catch (err) {
      const message = errorMessage(err);
      setLoading(false);
      if (onPaymentError) onPaymentError(message);
      else setError(message);
    }
  };

  return (
    <span className="inline-flex flex-col gap-1">
      <Button loading={loading} onClick={() => void pay()} {...rest}>
        {loading ? t.orders.paying : (label ?? t.orders.pay)}
      </Button>
      {error ? (
        <span role="alert" className="text-xs text-accent-600">
          {error}
        </span>
      ) : null}
    </span>
  );
}
