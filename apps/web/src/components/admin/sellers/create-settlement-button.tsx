'use client';

import type { AdminSettlementView } from '@pe/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Notice } from '@/components/admin/notice';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { adminFa } from '@/i18n/admin-fa';
import { adminErrorMessage } from '@/lib/admin/errors';
import { browserApi } from '@/lib/api/client';

const copy = adminFa.sellers.settlements;

interface CreateSettlementButtonProps {
  sellerId: string;
  /** Disables the button up front when the seller has nothing to settle. */
  pendingAmount: number;
}

/**
 * Creates a settlement batch from the seller's delivered, unsettled items
 * after confirmation, then opens the new batch so its payment can be recorded.
 * The API's "nothing to settle" (422) answer is shown inline.
 */
export function CreateSettlementButton({ sellerId, pendingAmount }: CreateSettlementButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const create = async () => {
    if (!window.confirm(copy.createConfirm)) return;
    setBusy(true);
    setNotice(null);
    try {
      const settlement = await browserApi.post<AdminSettlementView>(
        `/admin/sellers/${encodeURIComponent(sellerId)}/settlements`,
        {},
      );
      setNotice({ tone: 'success', message: copy.created });
      router.push(`/admin/settlements/${settlement.id}`);
      router.refresh();
    } catch (error) {
      setNotice({ tone: 'error', message: adminErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {notice ? <Alert tone={notice.tone}>{notice.message}</Alert> : null}
      <div>
        <Button
          variant="outline"
          loading={busy}
          disabled={busy || pendingAmount <= 0}
          onClick={() => void create()}
        >
          {busy ? copy.creating : copy.create}
        </Button>
      </div>
    </div>
  );
}
