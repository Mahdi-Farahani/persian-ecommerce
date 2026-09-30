'use client';

import type { ShipmentView } from '@pe/shared';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/form-field';
import { adminFa } from '@/i18n/admin-fa';
import { adminErrorMessage } from '@/lib/admin/errors';
import { browserApi } from '@/lib/api/client';

const copy = adminFa.orders;
const FIELD_MAX_LENGTH = 200;

export function ShipmentForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [carrier, setCarrier] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await browserApi.post<ShipmentView>(`/admin/orders/${orderId}/shipments`, {
        carrier: carrier.trim() || undefined,
        trackingCode: trackingCode.trim() || undefined,
        note: note.trim() || undefined,
      });
      setNotice({ tone: 'success', message: copy.shipmentAdded });
      setCarrier('');
      setTrackingCode('');
      setNote('');
      router.refresh();
    } catch (error) {
      setNotice({ tone: 'error', message: adminErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {notice ? <Alert tone={notice.tone}>{notice.message}</Alert> : null}
      <TextField
        label={copy.carrier}
        name="carrier"
        optional
        maxLength={FIELD_MAX_LENGTH}
        value={carrier}
        onChange={(event) => setCarrier(event.target.value)}
      />
      <TextField
        label={copy.trackingCode}
        name="trackingCode"
        optional
        dir="ltr"
        maxLength={FIELD_MAX_LENGTH}
        value={trackingCode}
        onChange={(event) => setTrackingCode(event.target.value)}
      />
      <TextField
        label={copy.shipmentNote}
        name="note"
        optional
        maxLength={FIELD_MAX_LENGTH}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <div>
        <Button type="submit" variant="outline" loading={busy}>
          {copy.addShipment}
        </Button>
      </div>
    </form>
  );
}
