import {
  SELLER_STATUS_LABELS,
  SETTLEMENT_STATUS_LABELS,
  type SellerStatus,
  type SettlementStatus,
} from '@pe/shared';
import { Badge } from '@/components/admin/badge';
import { sellerStatusTone, settlementStatusTone } from '@/lib/admin/sellers';

export function SellerStatusBadge({ status }: { status: SellerStatus }) {
  return <Badge tone={sellerStatusTone(status)}>{SELLER_STATUS_LABELS[status] ?? status}</Badge>;
}

export function SettlementStatusBadge({ status }: { status: SettlementStatus }) {
  return (
    <Badge tone={settlementStatusTone(status)}>{SETTLEMENT_STATUS_LABELS[status] ?? status}</Badge>
  );
}
