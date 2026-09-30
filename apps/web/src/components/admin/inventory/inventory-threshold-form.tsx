'use client';

import { toEnglishDigits, type InventorySnapshot } from '@pe/shared';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { Notice } from '@/components/admin/notice';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/form-field';
import { t } from '@/i18n';
import { adminFa } from '@/i18n/admin-fa';
import { adminErrorMessage } from '@/lib/admin/errors';
import { browserApi } from '@/lib/api/client';
import { cn } from '@/lib/utils';

const copy = adminFa.inventory;

export interface InventoryThresholdFormProps {
  variantId: string;
  current: number;
  onSuccess?: (snapshot: InventorySnapshot) => void | Promise<void>;
  onCancel?: () => void;
  className?: string;
}

/** Parses a non-negative integer typed with Persian or ASCII digits; null when invalid. */
function parseThreshold(raw: string): number | null {
  const digits = toEnglishDigits(raw).replace(/[,٬\s]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  return Number(digits);
}

/** Edits the low-stock threshold (`PATCH /admin/inventory/:id/threshold`). */
export function InventoryThresholdForm({
  variantId,
  current,
  onSuccess,
  onCancel,
  className,
}: InventoryThresholdFormProps) {
  const router = useRouter();
  const [value, setValue] = useState(String(current));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const threshold = parseThreshold(value);
    if (threshold === null) {
      setError(value.trim() ? adminFa.validation.nonNegative : adminFa.validation.required);
      return;
    }
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const snapshot = await browserApi.patch<InventorySnapshot>(
        `/admin/inventory/${encodeURIComponent(variantId)}/threshold`,
        { lowStockThreshold: threshold },
      );
      setNotice({ tone: 'success', message: copy.thresholdSaved });
      router.refresh();
      await onSuccess?.(snapshot);
    } catch (submitError) {
      setNotice({ tone: 'error', message: adminErrorMessage(submitError) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className={cn('flex flex-col gap-3', className)}>
      {notice ? <Alert tone={notice.tone}>{notice.message}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <TextField
          label={copy.thresholdLabel}
          name="lowStockThreshold"
          inputMode="numeric"
          dir="ltr"
          className="text-left"
          value={value}
          hint={copy.thresholdHint}
          error={error ?? undefined}
          onChange={(event) => setValue(event.target.value)}
        />
        <div className="flex items-start gap-2 sm:pt-7">
          <Button type="submit" variant="secondary" loading={busy}>
            {copy.saveThreshold}
          </Button>
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
              {t.common.cancel}
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  );
}
