import { REVIEW_STATUS_LABELS, type ReviewStatus } from '@pe/shared';
import { Badge } from '@/components/admin/badge';

const tones = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
} as const satisfies Record<ReviewStatus, 'warning' | 'success' | 'danger'>;

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  return <Badge tone={tones[status] ?? 'neutral'}>{REVIEW_STATUS_LABELS[status] ?? status}</Badge>;
}
