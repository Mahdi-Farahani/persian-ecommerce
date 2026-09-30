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
import { orderCategoriesAsTree } from '@/lib/admin/categories';
import { adminErrorMessage } from '@/lib/admin/errors';
import type { AdminCategory } from '@/lib/admin/types';
import { browserApi } from '@/lib/api/client';
import { CategoryForm } from './category-form';

interface CategoryManagerProps {
  categories: AdminCategory[];
  attributes: AttributeSummary[];
  canManage: boolean;
}

type Mode = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; category: AdminCategory };

const copy = adminFa.categories;

const columns = [
  { key: 'name', label: copy.table.name },
  { key: 'slug', label: copy.table.slug },
  { key: 'products', label: copy.table.products },
  { key: 'status', label: copy.table.status },
  { key: 'actions', label: adminFa.common.actions, srOnly: true, className: 'w-px' },
] as const;

/** Indented category tree with inline create/edit form and deletion. */
export function CategoryManager({ categories, attributes, canManage }: CategoryManagerProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const ordered = orderCategoriesAsTree(categories);

  const onSaved = () => {
    setMode({ kind: 'list' });
    setNotice({ tone: 'success', message: copy.saved });
    router.refresh();
  };

  const remove = async (category: AdminCategory) => {
    if (!window.confirm(copy.deleteConfirm)) return;
    setBusyId(category.id);
    setNotice(null);
    try {
      await browserApi.delete(`/admin/categories/${category.id}`);
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
          <CategoryForm
            key={mode.kind === 'edit' ? mode.category.id : 'create'}
            category={mode.kind === 'edit' ? mode.category : undefined}
            categories={categories}
            attributes={attributes}
            onSaved={onSaved}
            onCancel={() => setMode({ kind: 'list' })}
          />
        </Card>
      ) : null}
      <DataTable
        columns={columns}
        empty={ordered.length === 0}
        emptyMessage={copy.empty}
        caption={copy.title}
      >
        {ordered.map((category) => (
          <tr key={category.id} className="hover:bg-surface-muted/60">
            <Td>
              <span
                className="inline-flex items-center gap-2 font-medium"
                style={{ paddingInlineStart: `${category.depth * 1.5}rem` }}
              >
                {category.depth > 0 ? (
                  <span aria-hidden="true" className="text-ink-muted">
                    └
                  </span>
                ) : null}
                {category.name}
              </span>
            </Td>
            <Td>
              <span dir="ltr" className="text-xs text-ink-muted">
                {category.slug}
              </span>
            </Td>
            <Td className="tabular-nums">{formatPersianNumber(category.productCount)}</Td>
            <Td>
              <Badge tone={category.isActive ? 'success' : 'neutral'}>
                {category.isActive ? adminFa.common.active : adminFa.common.inactive}
              </Badge>
            </Td>
            <Td>
              {canManage ? (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMode({ kind: 'edit', category })}
                  >
                    {t.common.edit}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-accent-600"
                    loading={busyId === category.id}
                    onClick={() => remove(category)}
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
