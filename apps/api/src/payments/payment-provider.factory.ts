import { Injectable } from '@nestjs/common';
import type { PaymentProviderName } from '@pe/shared';
import { AppConfigService } from '../config/app-config.service.js';
import type { PaymentProvider, ProviderContext } from './payment-provider.types.js';
import { PaymentErrorCodes, PaymentProviderError } from './payment.errors.js';
import { ProviderHttpClient } from './provider-http.client.js';
import { DigiPayPaymentProvider } from './providers/digipay.provider.js';
import { MockPaymentProvider } from './providers/mock.provider.js';
import { SnappPayPaymentProvider } from './providers/snapp-pay.provider.js';
import { TorobPayPaymentProvider } from './providers/torob-pay.provider.js';
import { ZarinPalPaymentProvider } from './providers/zarinpal.provider.js';

export type ProviderConstructor = (
  context: ProviderContext,
  http: ProviderHttpClient,
  config: AppConfigService,
) => PaymentProvider;

/**
 * Builds adapter instances from a decrypted ProviderContext. Adapters are
 * stateless apart from their context, so a fresh instance per operation is
 * cheap and always reflects the latest admin configuration.
 */
@Injectable()
export class PaymentProviderFactory {
  private readonly constructors: Partial<Record<PaymentProviderName, ProviderConstructor>> = {
    MOCK: (context, _http, config) =>
      new MockPaymentProvider(context, `${config.payments.publicApiUrl}/payments/mock/gateway`),
    ZARINPAL: (context, http) => new ZarinPalPaymentProvider(context, http),
    SNAPP_PAY: (context, http) => new SnappPayPaymentProvider(context, http),
    DIGIPAY: (context, http) => new DigiPayPaymentProvider(context, http),
    TOROB_PAY: (context, http) => new TorobPayPaymentProvider(context, http),
  };

  /** Overridable in tests to stub provider HTTP calls. */
  fetchImpl: typeof fetch = fetch;

  constructor(private readonly config: AppConfigService) {}

  /**
   * Registers or overrides an adapter constructor (used by adapters added
   * later and by tests). Returns the previous constructor so callers can
   * restore it.
   */
  register(
    provider: PaymentProviderName,
    ctor: ProviderConstructor,
  ): ProviderConstructor | undefined {
    const previous = this.constructors[provider];
    this.constructors[provider] = ctor;
    return previous;
  }

  supports(provider: PaymentProviderName): boolean {
    return Boolean(this.constructors[provider]);
  }

  create(context: ProviderContext): PaymentProvider {
    const ctor = this.constructors[context.provider];
    if (!ctor) {
      throw new PaymentProviderError(
        PaymentErrorCodes.NotSupported,
        `درگاه ${context.provider} پیاده‌سازی نشده است`,
      );
    }
    return ctor(context, new ProviderHttpClient(context.provider, this.fetchImpl), this.config);
  }
}
