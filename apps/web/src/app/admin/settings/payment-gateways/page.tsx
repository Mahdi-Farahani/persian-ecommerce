import {
  PAYMENT_PROVIDER_LABELS,
  PaymentProviders,
  hasPermission,
  type PaymentProviderName,
} from '@pe/shared';
import { GatewayCard } from '@/components/admin/payment-gateways/gateway-card';
import { PageHeader } from '@/components/admin/page-header';
import { Alert } from '@/components/ui/alert';
import { adminFa } from '@/i18n/admin-fa';
import { AdminPermissions } from '@/lib/admin/navigation';
import { adminListPaymentGateways } from '@/lib/admin/server';
import { requireUser } from '@/lib/auth/server';

export const metadata = { title: adminFa.gateways.title };

const copy = adminFa.gateways;
const TEST_OUTCOMES = ['OK', 'FAILED', 'CANCELLED', 'UNKNOWN'] as const;
type TestOutcome = (typeof TEST_OUTCOMES)[number];

function isProvider(value: string | undefined): value is PaymentProviderName {
  return Boolean(value) && (PaymentProviders as readonly string[]).includes(value as string);
}

function isOutcome(value: string | undefined): value is TestOutcome {
  return Boolean(value) && (TEST_OUTCOMES as readonly string[]).includes(value as string);
}

export default async function AdminPaymentGatewaysPage({
  searchParams,
}: {
  searchParams: Promise<{ test?: string; outcome?: string }>;
}) {
  const user = await requireUser('/admin/settings/payment-gateways');
  const params = await searchParams;
  const gateways = await adminListPaymentGateways();
  const permissions = {
    update: hasPermission(user, AdminPermissions.paymentGatewayUpdate),
    test: hasPermission(user, AdminPermissions.paymentGatewayTest),
  };

  const testProvider = isProvider(params.test) ? params.test : null;
  const testOutcome = isOutcome(params.outcome) ? params.outcome : null;
  const testNotice =
    testProvider && testOutcome
      ? copy.testOutcome[testOutcome]?.(PAYMENT_PROVIDER_LABELS[testProvider])
      : null;

  return (
    <div>
      <PageHeader title={copy.title} description={copy.description} />
      {testNotice ? (
        <Alert tone={testOutcome === 'OK' ? 'success' : 'warning'} className="mb-4">
          {testNotice}
        </Alert>
      ) : null}
      <div className="flex flex-col gap-6">
        {gateways.map((gateway) => (
          <GatewayCard
            key={`${gateway.provider}:${gateway.updatedAt}`}
            gateway={gateway}
            permissions={permissions}
          />
        ))}
      </div>
    </div>
  );
}
