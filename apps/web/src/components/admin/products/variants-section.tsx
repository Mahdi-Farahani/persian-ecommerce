'use client';

import { formatPersianNumber, type AttributeSummary } from '@pe/shared';
import { useState } from 'react';
import { Badge } from '@/components/admin/badge';
import { DataTable, Td } from '@/components/admin/data-table';
import type { Notice } from '@/components/admin/notice';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { adminFa } from '@/i18n/admin-fa';
import { adminErrorMessage } from '@/lib/admin/errors';
import type { VariantFormValues } from '@/lib/admin/schemas';
import { VariantForm } from './variant-form';

export interface VariantRow {
  key: string;
  values: VariantFormValues;
  attributeLabels: string[];
  /** Only known for persisted variants. */
  availableQuantity?: number;
}

interface VariantsSectionProps {
  rows: VariantRow[];
  variantAttributes: AttributeSummary[];
  /** Stock fields are shown when adding a variant (never when editing one). */
  showStockFields: boolean;
  readOnly: boolean;
  onAdd: (values: VariantFormValues) => Promise<void>;
  onUpdate: (key: string, values: VariantFormValues) => Promise<void>;
  onRemove: (key: string) => Promise<void>;
}

type Editor = { kind: 'closed' } | { kind: 'add' } | { kind: 'edit'; key: string };

const copy = adminFa.products.variants;

const columns = [
  { key: 'sku', label: copy.sku },
  { key: 'title', label: copy.title },
  { key: 'price', label: copy.price },
  { key: 'compareAt', label: copy.compareAtPrice },
  { key: 'attributes', label: copy.attributeValues },
  { key: 'status', label: copy.status },
  { key: 'actions', label: adminFa.common.actions, srOnly: true, className: 'w-px' },
] as const;

/** Mode-agnostic variants table + inline add/edit form. */
export function VariantsSection({
  rows,
  variantAttributes,
  showStockFields,
  readOnly,
  onAdd,
  onUpdate,
  onRemove,
}: VariantsSectionProps) {
  const [editor, setEditor] = useState<Editor>({ kind: 'closed' });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const editing = editor.kind === 'edit' ? rows.find((row) => row.key === editor.key) : undefined;

  const remove = async (key: string) => {
    if (!window.confirm(copy.deleteConfirm)) return;
    setBusyKey(key);
    setNotice(null);
    try {
      await onRemove(key);
      setNotice({ tone: 'success', message: copy.deleted });
    } catch (error) {
      setNotice({ tone: 'error', message: adminErrorMessage(error) });
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {notice ? <Alert tone={notice.tone}>{notice.message}</Alert> : null}
      <DataTable
        columns={columns}
        empty={rows.length === 0}
        emptyMessage={copy.empty}
        caption={adminFa.products.sections.variants}
      >
        {rows.map((row) => (
          <tr key={row.key}>
            <Td>
              <span dir="ltr" className="font-mono text-xs">
                {row.values.sku}
              </span>
              {row.values.isDefault ? (
                <Badge tone="info" className="ms-2">
                  {copy.default}
                </Badge>
              ) : null}
            </Td>
            <Td>{row.values.title || adminFa.common.none}</Td>
            <Td className="tabular-nums">{formatPersianNumber(row.values.priceToman)}</Td>
            <Td className="tabular-nums text-ink-muted">
              {row.values.compareAtPriceToman === undefined
                ? adminFa.common.none
                : formatPersianNumber(row.values.compareAtPriceToman)}
            </Td>
            <Td className="text-xs text-ink-muted">
              {row.attributeLabels.length > 0
                ? row.attributeLabels.join('، ')
                : adminFa.common.none}
              {row.availableQuantity !== undefined ? (
                <span className="block">
                  {copy.available}: {formatPersianNumber(row.availableQuantity)}
                </span>
              ) : null}
            </Td>
            <Td>
              <Badge tone={row.values.status === 'ACTIVE' ? 'success' : 'neutral'}>
                {copy.statusLabels[row.values.status] ?? row.values.status}
              </Badge>
            </Td>
            <Td>
              {readOnly ? null : (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditor({ kind: 'edit', key: row.key })}
                  >
                    {t.common.edit}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-accent-600"
                    loading={busyKey === row.key}
                    onClick={() => remove(row.key)}
                  >
                    {t.common.delete}
                  </Button>
                </div>
              )}
            </Td>
          </tr>
        ))}
      </DataTable>
      {readOnly ? null : editor.kind === 'closed' ? (
        <div>
          <Button variant="secondary" onClick={() => setEditor({ kind: 'add' })}>
            {copy.add}
          </Button>
        </div>
      ) : (
        <VariantForm
          key={editor.kind === 'edit' ? editor.key : 'add'}
          variantAttributes={variantAttributes}
          initial={editing?.values}
          showStockFields={editor.kind === 'add' && showStockFields}
          onSubmit={async (values) => {
            if (editor.kind === 'edit') await onUpdate(editor.key, values);
            else await onAdd(values);
            setNotice({ tone: 'success', message: copy.saved });
            setEditor({ kind: 'closed' });
          }}
          onCancel={() => setEditor({ kind: 'closed' })}
        />
      )}
    </div>
  );
}
