import type { PaymentProviderName } from '@pe/shared';
import { PaymentProviders } from '@pe/shared';
import type { ProviderDefinition } from './payment-provider.types.js';
import { DIGIPAY_DEFINITION } from './providers/digipay.provider.js';
import { MOCK_DEFINITION } from './providers/mock.provider.js';
import { SNAPP_PAY_DEFINITION } from './providers/snapp-pay.provider.js';
import { TOROB_PAY_DEFINITION } from './providers/torob-pay.provider.js';
import { ZARINPAL_DEFINITION } from './providers/zarinpal.provider.js';

/**
 * Static catalogue of providers. Adding a provider = adding an adapter, its
 * definition here and its constructor in PaymentProviderFactory.
 */
export const PROVIDER_DEFINITIONS: Record<PaymentProviderName, ProviderDefinition> = {
  ZARINPAL: ZARINPAL_DEFINITION,
  SNAPP_PAY: SNAPP_PAY_DEFINITION,
  DIGIPAY: DIGIPAY_DEFINITION,
  TOROB_PAY: TOROB_PAY_DEFINITION,
  MOCK: MOCK_DEFINITION,
};

/** URL-safe provider slugs used in callback routes (`/payments/zarinpal/callback`). */
export const PROVIDER_SLUGS: Record<PaymentProviderName, string> = {
  ZARINPAL: 'zarinpal',
  SNAPP_PAY: 'snapp-pay',
  DIGIPAY: 'digipay',
  TOROB_PAY: 'torob-pay',
  MOCK: 'mock',
};

/** Environment-variable prefixes used for bootstrap configuration. */
export const PROVIDER_ENV_PREFIXES: Record<PaymentProviderName, string> = {
  ZARINPAL: 'ZARINPAL',
  SNAPP_PAY: 'SNAPP_PAY',
  DIGIPAY: 'DIGIPAY',
  TOROB_PAY: 'TOROB_PAY',
  MOCK: 'PAYMENT_MOCK',
};

export function providerFromSlug(slug: string): PaymentProviderName | null {
  const normalized = slug.toLowerCase();
  for (const name of PaymentProviders) {
    if (PROVIDER_SLUGS[name] === normalized || name.toLowerCase() === normalized) return name;
  }
  return null;
}

/** `merchantId` → `MERCHANT_ID` for `<PREFIX>_MERCHANT_ID` bootstrap variables. */
export function envKeyFor(provider: PaymentProviderName, fieldKey: string): string {
  const snake = fieldKey.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
  return `${PROVIDER_ENV_PREFIXES[provider]}_${snake}`;
}
