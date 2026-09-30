'use client';

import type { OrderDetail } from '@pe/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PayOrderButton } from '@/components/payment/pay-order-button';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { browserApi } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/error-message';

/** Pay / cancel controls for the customer's order page. */
export function OrderActions({ order }: { order: OrderDetail }) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const cancel = async () => {
    if (!window.confirm(t.orders.cancelConfirm)) return;
    setCancelling(true);
    setNotice(null);
    try {
      await browserApi.post<OrderDetail>(`/orders/${order.id}/cancel`, {});
      setNotice({ tone: 'success', message: t.orders.cancelled });
      router.refresh();
    } catch (error) {
      setNotice({ tone: 'error', message: errorMessage(error) });
    } finally {
      setCancelling(false);
    }
  };

  if (!order.payable && !order.cancellable && !notice) return null;

  return (
    <div className="flex flex-col gap-3">
      {notice ? <Alert tone={notice.tone}>{notice.message}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        {order.payable ? (
          <PayOrderButton
            orderId={order.id}
            onPaymentError={(message) => setNotice({ tone: 'error', message })}
          />
        ) : null}
        {order.cancellable ? (
          <Button variant="outline" loading={cancelling} onClick={() => void cancel()}>
            {t.orders.cancel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
