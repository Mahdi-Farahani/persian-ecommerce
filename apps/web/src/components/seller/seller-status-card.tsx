import {
  SELLER_STATUS_LABELS,
  formatJalaliDate,
  toPersianDigits,
  type SellerProfileView,
} from '@pe/shared';
import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { Card, CardTitle } from '@/components/ui/card';
import { t } from '@/i18n';
import { sellerStatusTone } from '@/lib/seller/status';
import { SellerBadge } from './badge';

const COMMISSION_BPS_PER_PERCENT = 100;

/** Status of a seller application, shown on `/seller/apply` and inside the portal when not approved. */
export function SellerStatusCard({
  profile,
  onEdit,
}: {
  profile: SellerProfileView;
  /** Rendered as an "edit" button when provided (client parent controls the form). */
  onEdit?: () => void;
}) {
  const tone = sellerStatusTone(profile.status);
  const alertTone =
    tone === 'success' ? 'success' : tone === 'danger' ? 'error' : ('warning' as const);
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle className="mb-0">{t.seller.status.title}</CardTitle>
        <SellerBadge tone={tone}>{SELLER_STATUS_LABELS[profile.status]}</SellerBadge>
      </div>
      <Alert tone={alertTone} className="mt-4">
        {t.seller.status.messages[profile.status]}
      </Alert>
      {profile.status === 'REJECTED' ? (
        <div className="mt-4 rounded-lg border border-border bg-surface-muted p-3 text-sm">
          <p className="font-medium">{t.seller.status.rejectionReason}</p>
          <p className="mt-1 text-ink-muted">{profile.rejectionReason ?? '—'}</p>
          <p className="mt-2 text-xs text-ink-muted">{t.seller.status.resubmitHint}</p>
        </div>
      ) : null}
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-ink-muted">{t.seller.status.storeName}</dt>
          <dd className="font-medium">{profile.storeName}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">{t.seller.status.submittedAt}</dt>
          <dd className="font-medium">{formatJalaliDate(profile.createdAt)}</dd>
        </div>
        {profile.approvedAt ? (
          <div>
            <dt className="text-ink-muted">{t.seller.status.approvedAt}</dt>
            <dd className="font-medium">{formatJalaliDate(profile.approvedAt)}</dd>
          </div>
        ) : null}
        {profile.status === 'APPROVED' ? (
          <div>
            <dt className="text-ink-muted">{t.seller.status.commission}</dt>
            <dd className="font-medium">
              {t.seller.status.commissionPercent(
                toPersianDigits(profile.commissionBps / COMMISSION_BPS_PER_PERCENT),
              )}
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-5 flex flex-wrap gap-2">
        {profile.status === 'APPROVED' ? (
          <Link
            href="/seller"
            className="inline-flex h-11 items-center rounded-lg bg-brand-600 px-5 text-sm font-bold text-white hover:bg-brand-700"
          >
            {t.seller.status.goToPortal}
          </Link>
        ) : null}
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-11 items-center rounded-lg border border-border bg-surface px-5 text-sm font-bold hover:border-brand-400 hover:text-brand-700"
          >
            {t.seller.status.editApplication}
          </button>
        ) : null}
      </div>
    </Card>
  );
}
