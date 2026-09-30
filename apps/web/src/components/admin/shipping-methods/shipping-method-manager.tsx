'use client';

import { formatPersianNumber, toPersianDigits, toToman } from '@pe/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/admin/badge';
import { DataTable, Td } from '@/components/admin/data-table';
import type { Notice } from '@/components/admin/notice';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { t } from '@/i18n';
import { adminFa } from '@/i18n/admin-fa';
import { adminErrorMessage } from '@/lib/admin/errors';
import type { AdminShippingMethod } from '@/lib/admin/types';
import { browserApi } from '@/lib/api/client';
import { ShippingMethodForm } from './shipping-method-form';

interface ShippingMethodManagerProps {
  methods: AdminShippingMethod[];
  canManage: boolean;
}

type Mode = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; method: AdminShippingMethod };

const copy = adminFa.shippingMethods;

const columns = [
  { key: 'name', label: copy.table.name },
  { key: 'code', label: copy.table.code },
  { key: 'baseFee', label: copy.table.baseFee },
  { key: 'freeAbove', label: copy.table.freeAbove },
  { key: 'estimate', label: copy.table.estimate },
  { key: 'sortOrder', label: copy.table.sortOrder },
  { key: 'status', label: copy.table.status },
  { key: 'actions', label: adminFa.common.actions, srOnly: true, className: 'w-px' },
] as const;

function estimate(method: AdminShippingMethod): string {
  if (method.estimatedDaysMin === 0 && method.estimatedDaysMax === 0) return copy.sameDay;
  return copy.days(
    toPersianDigits(method.estimatedDaysMin),
    toPersianDigits(method.estimatedDaysMax),
  );
}

export function ShippingMethodManager({ methods, canManage }: ShippingMethodManagerProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const onSaved = () => {
    setMode({ kind: 'list' });
    setNotice({ tone: 'success', message: copy.saved });
    router.refresh();
  };

  const remove = async (method: AdminShippingMethod) => {
    if (!window.confirm(copy.deleteConfirm)) return;
    setBusyId(method.id);
    setNotice(null);
    try {
      await browserApi.delete(`/admin/shipping-methods/${method.id}`);
      setNotice({ tone: 'success', message: copy.deleted });
      router.refresh();
    } catch (error) {
      setNotice({ tone: 'error', message: adminErrorMessage(error) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {notice ? <Alert tone={notice.tone}>{notice.message}</Alert> : null}
      {!canManage ? <Alert tone="info">{copy.readOnly}</Alert> : null}
      {canManage && mode.kind === 'list' ? (
        <div>
          <Button onClick={() => setMode({ kind: 'create' })}>{copy.add}</Button>
        </div>
      ) : null}
      {mode.kind !== 'list' ? (
        <Card>
          <CardTitle>{mode.kind === 'edit' ? copy.editTitle : copy.newTitle}</CardTitle>
          <ShippingMethodForm
            key={mode.kind === 'edit' ? mode.method.id : 'create'}
            method={mode.kind === 'edit' ? mode.method : undefined}
            onSaved={onSaved}
            onCancel={() => setMode({ kind: 'list' })}
          />
        </Card>
      ) : null}
      <DataTable
        columns={columns}
        empty={methods.length === 0}
        emptyMessage={copy.empty}
        caption={copy.title}
      >
        {methods.map((method) => (
          <tr key={method.id} className="hover:bg-surface-muted/60">
            <Td>
              <span className="font-medium">{method.name}</span>
              {method.description ? (
                <span className="block max-w-xs truncate text-xs text-ink-muted">
                  {method.description}
                </span>
              ) : null}
            </Td>
            <Td>
              <span dir="ltr" className="font-mono text-xs text-ink-muted">
                {method.code}
              </span>
            </Td>
            <Td className="tabular-nums">{formatPersianNumber(toToman(method.baseFee))}</Td>
            <Td className="tabular-nums">
              {method.freeAboveAmount === null
                ? copy.noFreeThreshold
                : formatPersianNumber(toToman(method.freeAboveAmount))}
            </Td>
            <Td>{estimate(method)}</Td>
            <Td className="tabular-nums">{formatPersianNumber(method.sortOrder)}</Td>
            <Td>
              <Badge tone={method.isActive ? 'success' : 'neutral'}>
                {method.isActive ? adminFa.common.active : adminFa.common.inactive}
              </Badge>
            </Td>
            <Td>
              {canManage ? (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMode({ kind: 'edit', method })}
                  >
                    {t.common.edit}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-accent-600"
                    loading={busyId === method.id}
                    onClick={() => remove(method)}
                  >
                    {t.common.delete}
                  </Button>
                </div>
              ) : null}
            </Td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
