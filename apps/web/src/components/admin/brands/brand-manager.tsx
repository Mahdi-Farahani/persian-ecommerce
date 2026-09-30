'use client';

import { formatPersianNumber, type BrandDetail } from '@pe/shared';
import Image from 'next/image';
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
import { assetUrl } from '@/lib/assets';
import { BrandForm } from './brand-form';

interface BrandManagerProps {
  brands: BrandDetail[];
  canManage: boolean;
}

type Mode = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; brand: BrandDetail };

const copy = adminFa.brands;

const columns = [
  { key: 'logo', label: copy.table.logo, className: 'w-16' },
  { key: 'name', label: copy.table.name },
  { key: 'nameEn', label: copy.table.nameEn },
  { key: 'slug', label: copy.table.slug },
  { key: 'products', label: copy.table.products },
  { key: 'status', label: copy.table.status },
  { key: 'actions', label: adminFa.common.actions, srOnly: true, className: 'w-px' },
] as const;

export function BrandManager({ brands, canManage }: BrandManagerProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const onSaved = () => {
    setMode({ kind: 'list' });
    setNotice({ tone: 'success', message: copy.saved });
    router.refresh();
  };

  const remove = async (brand: BrandDetail) => {
    if (!window.confirm(copy.deleteConfirm)) return;
    setBusyId(brand.id);
    setNotice(null);
    try {
      await browserApi.delete(`/admin/brands/${brand.id}`);
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
          <BrandForm
            key={mode.kind === 'edit' ? mode.brand.id : 'create'}
            brand={mode.kind === 'edit' ? mode.brand : undefined}
            onSaved={onSaved}
            onCancel={() => setMode({ kind: 'list' })}
          />
        </Card>
      ) : null}
      <DataTable
        columns={columns}
        empty={brands.length === 0}
        emptyMessage={copy.empty}
        caption={copy.title}
      >
        {brands.map((brand) => {
          const logo = assetUrl(brand.logoUrl);
          return (
            <tr key={brand.id} className="hover:bg-surface-muted/60">
              <Td>
                <div className="relative size-10 overflow-hidden rounded-lg border border-border bg-surface-muted">
                  {logo ? (
                    <Image
                      src={logo}
                      alt=""
                      fill
                      sizes="40px"
                      className="object-contain"
                      unoptimized
                    />
                  ) : null}
                </div>
              </Td>
              <Td className="font-medium">{brand.name}</Td>
              <Td dir="ltr" className="text-start text-ink-muted">
                {brand.nameEn ?? adminFa.common.none}
              </Td>
              <Td>
                <span dir="ltr" className="text-xs text-ink-muted">
                  {brand.slug}
                </span>
              </Td>
              <Td className="tabular-nums">{formatPersianNumber(brand.productCount)}</Td>
              <Td>
                <Badge tone={brand.isActive ? 'success' : 'neutral'}>
                  {brand.isActive ? adminFa.common.active : adminFa.common.inactive}
                </Badge>
              </Td>
              <Td>
                {canManage ? (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setMode({ kind: 'edit', brand })}
                    >
                      {t.common.edit}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-accent-600"
                      loading={busyId === brand.id}
                      onClick={() => remove(brand)}
                    >
                      {t.common.delete}
                    </Button>
                  </div>
                ) : null}
              </Td>
            </tr>
          );
        })}
      </DataTable>
    </div>
  );
}
