'use client';

import { formatPersianNumber, type AttributeSummary } from '@pe/shared';
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
import { browserApi } from '@/lib/api/client';
import { AttributeForm } from './attribute-form';

interface AttributeManagerProps {
  attributes: AttributeSummary[];
  canManage: boolean;
}

type Mode = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; attribute: AttributeSummary };

const copy = adminFa.attributes;

const columns = [
  { key: 'name', label: copy.table.name },
  { key: 'slug', label: copy.table.slug },
  { key: 'type', label: copy.table.type },
  { key: 'values', label: copy.table.values },
  { key: 'flags', label: copy.table.flags },
  { key: 'actions', label: adminFa.common.actions, srOnly: true, className: 'w-px' },
] as const;

export function AttributeManager({ attributes, canManage }: AttributeManagerProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const onSaved = () => {
    setMode({ kind: 'list' });
    setNotice({ tone: 'success', message: copy.saved });
    router.refresh();
  };

  const remove = async (attribute: AttributeSummary) => {
    if (!window.confirm(copy.deleteConfirm)) return;
    setBusyId(attribute.id);
    setNotice(null);
    try {
      await browserApi.delete(`/admin/attributes/${attribute.id}`);
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
      {canManage && mode.kind === 'list' ? (
        <div>
          <Button onClick={() => setMode({ kind: 'create' })}>{copy.add}</Button>
        </div>
      ) : null}
      {mode.kind !== 'list' ? (
        <Card>
          <CardTitle>{mode.kind === 'edit' ? copy.editTitle : copy.newTitle}</CardTitle>
          <AttributeForm
            key={mode.kind === 'edit' ? mode.attribute.id : 'create'}
            attribute={mode.kind === 'edit' ? mode.attribute : undefined}
            onSaved={onSaved}
            onCancel={() => setMode({ kind: 'list' })}
          />
        </Card>
      ) : null}
      <DataTable
        columns={columns}
        empty={attributes.length === 0}
        emptyMessage={copy.empty}
        caption={copy.title}
      >
        {attributes.map((attribute) => (
          <tr key={attribute.id} className="hover:bg-surface-muted/60">
            <Td className="font-medium">
              {attribute.name}
              {attribute.unit ? (
                <span className="ms-1 text-xs text-ink-muted">({attribute.unit})</span>
              ) : null}
            </Td>
            <Td>
              <span dir="ltr" className="text-xs text-ink-muted">
                {attribute.slug}
              </span>
            </Td>
            <Td>{copy.types[attribute.type] ?? attribute.type}</Td>
            <Td className="tabular-nums">
              {attribute.type === 'SELECT'
                ? formatPersianNumber(attribute.values.length)
                : adminFa.common.none}
            </Td>
            <Td>
              <div className="flex flex-wrap gap-1">
                {attribute.isVariant ? <Badge tone="info">{copy.variantBadge}</Badge> : null}
                {attribute.isFilterable ? (
                  <Badge tone="success">{copy.filterableBadge}</Badge>
                ) : null}
              </div>
            </Td>
            <Td>
              {canManage ? (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMode({ kind: 'edit', attribute })}
                  >
                    {t.common.edit}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-accent-600"
                    loading={busyId === attribute.id}
                    onClick={() => remove(attribute)}
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
