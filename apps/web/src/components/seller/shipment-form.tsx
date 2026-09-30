'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import type { SellerOrderView } from '@pe/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { TextField } from '@/components/ui/form-field';
import { t } from '@/i18n';
import { browserApi } from '@/lib/api/client';
import { sellerErrorMessage } from '@/lib/seller/errors';
import {
  sellerShipmentSchema,
  toSellerShipmentPayload,
  type SellerShipmentFormValues,
} from '@/lib/seller/schemas';

const copy = t.seller.orders.ship;

export interface ShipmentFormProps {
  orderId: string;
  onSuccess?: (order: SellerOrderView) => void | Promise<void>;
}

/**
 * "ثبت مرسوله": records the seller's dispatch for an order
 * (`POST /seller/orders/:id/shipments`). Once submitted the form is replaced
 * by a confirmation, because a seller dispatches an order only once.
 */
export function ShipmentForm({ orderId, onSuccess }: ShipmentFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SellerShipmentFormValues>({
    resolver: yupResolver(sellerShipmentSchema),
    defaultValues: { carrier: '', trackingCode: '', note: '' },
  });

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      const order = await browserApi.post<SellerOrderView>(
        `/seller/orders/${encodeURIComponent(orderId)}/shipments`,
        toSellerShipmentPayload(values),
      );
      setDone(true);
      router.refresh();
      await onSuccess?.(order);
    } catch (err) {
      setError(sellerErrorMessage(err));
    }
  });

  if (done) {
    return <Alert tone="success">{copy.done}</Alert>;
  }

  return (
    <Card>
      <CardTitle>{copy.title}</CardTitle>
      <p className="mb-4 text-sm text-ink-muted">{copy.hint}</p>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={copy.carrier}
            optional
            error={errors.carrier?.message}
            {...register('carrier')}
          />
          <TextField
            label={copy.trackingCode}
            optional
            dir="ltr"
            className="text-left"
            error={errors.trackingCode?.message}
            {...register('trackingCode')}
          />
        </div>
        <TextField label={copy.note} optional error={errors.note?.message} {...register('note')} />
        <div>
          <Button type="submit" loading={isSubmitting}>
            {copy.submit}
          </Button>
        </div>
      </form>
    </Card>
  );
}
