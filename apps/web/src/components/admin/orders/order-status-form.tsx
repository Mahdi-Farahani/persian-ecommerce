'use client';

import type { AdminOrderDetail, OrderStatus } from '@pe/shared';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SelectField, TextAreaField } from '@/components/ui/form-field';
import { adminFa } from '@/i18n/admin-fa';
import { adminErrorMessage } from '@/lib/admin/errors';
import { browserApi } from '@/lib/api/client';
import { ADMIN_SETTABLE_ORDER_STATUSES, orderStatusLabel } from '@/lib/orders/status';

const copy = adminFa.orders;
const NOTE_MAX_LENGTH = 500;

const options = ADMIN_SETTABLE_ORDER_STATUSES.map((status) => ({
  value: status,
  label: orderStatusLabel(status),
}));

export function OrderStatusForm({ order }: { order: AdminOrderDetail }) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!status) return;
    if (status === order.status) {
      setNotice({ tone: 'error', message: copy.statusUnchanged });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await browserApi.patch<AdminOrderDetail>(`/admin/orders/${order.id}/status`, {
        status,
        note: note.trim() || undefined,
      });
      setNotice({ tone: 'success', message: copy.statusChanged });
      setStatus('');
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
      <SelectField
        label={copy.newStatus}
        name="status"
        value={status}
        placeholder={adminFa.common.none}
        options={options}
        onChange={(event) => setStatus(event.target.value as OrderStatus | '')}
      />
      <TextAreaField
        label={copy.statusNote}
        name="note"
        value={note}
        maxLength={NOTE_MAX_LENGTH}
        onChange={(event) => setNote(event.target.value)}
        className="min-h-20"
      />
      <div>
        <Button type="submit" disabled={!status} loading={busy}>
          {copy.submitStatus}
        </Button>
      </div>
    </form>
  );
}
