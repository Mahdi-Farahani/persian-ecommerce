import type { AdminPaymentDetail, AdminPaymentSummary } from '@pe/shared';
import { formatOrderNumber } from '@pe/shared';
import { redactSecrets } from '../audit/audit.service.js';
import { money } from '../common/utils/money.util.js';
import type { Prisma } from '../generated/prisma/client.js';
import { toPaymentView } from '../orders/orders.mapper.js';

export const adminPaymentInclude = {
  order: {
    select: {
      number: true,
      status: true,
      user: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.PaymentInclude;

export const adminPaymentDetailInclude = {
  ...adminPaymentInclude,
  transactions: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.PaymentInclude;

export type AdminPaymentRow = Prisma.PaymentGetPayload<{ include: typeof adminPaymentInclude }>;
export type AdminPaymentDetailRow = Prisma.PaymentGetPayload<{
  include: typeof adminPaymentDetailInclude;
}>;

export function toAdminPaymentSummary(row: AdminPaymentRow): AdminPaymentSummary {
  const user = row.order.user;
  return {
    ...toPaymentView(row, row.order.number),
    orderStatus: row.order.status,
    customer: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name:
        [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || user.phone || '',
    },
    callbackAt: row.callbackAt?.toISOString() ?? null,
    redirectedAt: row.redirectedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toAdminPaymentDetail(row: AdminPaymentDetailRow): AdminPaymentDetail {
  return {
    ...toAdminPaymentSummary(row),
    requestId: row.requestId,
    transactions: row.transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: money(t.amount),
      succeeded: t.succeeded,
      providerReference: t.providerReference,
      errorCode: t.errorCode,
      createdAt: t.createdAt.toISOString(),
    })),
    callbackPayload: redactSecrets(row.callbackPayload),
    verificationPayload: redactSecrets(row.verificationPayload),
  };
}

export { formatOrderNumber };
