import type { PaymentProviderName } from '@pe/shared';

/** URL slug used by the admin gateway endpoints for each provider. */
export const PROVIDER_SLUGS: Record<PaymentProviderName, string> = {
  ZARINPAL: 'zarinpal',
  SNAPP_PAY: 'snapp-pay',
  DIGIPAY: 'digipay',
  TOROB_PAY: 'torob-pay',
  MOCK: 'mock',
};

export function providerSlug(provider: PaymentProviderName): string {
  return PROVIDER_SLUGS[provider];
}

/** Masked secrets come back from the API prefixed with bullets. */
export const MASK_PREFIX = '•';

export function isMaskedValue(value: string): boolean {
  return value.startsWith(MASK_PREFIX);
}
