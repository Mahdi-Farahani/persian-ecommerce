'use client';

import { ProductStatuses, type ProductDetail, type ProductStatus } from '@pe/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { adminFa } from '@/i18n/admin-fa';
import { adminErrorMessage } from '@/lib/admin/errors';
import { browserApi } from '@/lib/api/client';

interface ProductRowActionsProps {
  productId: string;
  status: ProductStatus;
  canManage: boolean;
}

/** Inline status select + edit/delete actions for a products table row. */
export function ProductRowActions({ productId, status, canManage }: ProductRowActionsProps) {
  const router = useRouter();
  const selectId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeStatus = async (next: string) => {
    if (next === status) return;
    setBusy(true);
    setError(null);
    try {
      await browserApi.patch<ProductDetail>(`/admin/products/${productId}/status`, {
        status: next,
      });
      router.refresh();
    } catch (changeError) {
      setError(adminErrorMessage(changeError));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(adminFa.products.deleteConfirm)) return;
    setBusy(true);
    setError(null);
    try {
      await browserApi.delete(`/admin/products/${productId}`);
      router.refresh();
    } catch (deleteError) {
      setError(adminErrorMessage(deleteError));
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        {canManage ? (
          <>
            <label htmlFor={selectId} className="sr-only">
              {adminFa.products.changeStatus}
            </label>
            <select
              id={selectId}
              value={status}
              disabled={busy}
              onChange={(event) => void changeStatus(event.target.value)}
              className="h-9 rounded-lg border border-border bg-surface px-2 text-xs"
            >
              {ProductStatuses.map((option) => (
                <option key={option} value={option}>
                  {adminFa.products.status[option] ?? option}
                </option>
              ))}
            </select>
          </>
        ) : null}
        <Link
          href={`/admin/products/${productId}`}
          className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-medium hover:border-brand-400 hover:text-brand-700"
        >
          {canManage ? t.common.edit : adminFa.common.open}
        </Link>
        {canManage ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-accent-600"
            disabled={busy}
            onClick={remove}
          >
            {t.common.delete}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-accent-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
