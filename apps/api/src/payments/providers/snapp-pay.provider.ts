import type {
  CreatePaymentRequest,
  ProviderContext,
  ProviderDefinition,
} from '../payment-provider.types.js';
import type { ProviderHttpClient } from '../provider-http.client.js';
import {
  BNPL_PATH_LABELS,
  BNPL_PATH_SETTINGS,
  BnplTokenProviderBase,
} from './bnpl-token.provider.base.js';
import {
  AMOUNT_UNIT_FIELD,
  baseUrlFields,
  CONTRACT_DOCS_FIELD,
  type OAuthPasswordGrant,
  pathField,
  requireCredential,
} from './oauth-bearer.support.js';

/**
 * SnappPay (installment / BNPL) adapter — OAuth2 bearer-token REST client.
 *
 * Documentation status: UNVERIFIED. SnappPay publishes no developer
 * documentation; it is delivered privately after the merchant contract
 * (research: docs/payments/research/SNAPPPAY.md). No base URL is known, so
 * both environment URLs start empty and the adapter refuses to run until an
 * operator fills them in and confirms the contract documentation. Paths
 * default to the names reported by third-party packages so they can be
 * checked quickly; all of them, and every field name, are UNVERIFIED.
 */

export const SNAPP_PAY_DISPLAY_NAME = 'اسنپ‌پی';
/** Academy SNIPPET: go-live acceptance requires a test order of at least 100,000 toman. */
export const SNAPP_PAY_MIN_AMOUNT_IRR = 1_000_000;

const CREDENTIAL_HELP =
  'نام‌گذاری بر اساس گزارش‌های غیررسمی است؛ با اطلاعات دسترسی‌ای که اسنپ‌پی پس از قرارداد صادر می‌کند تطبیق دهید';

export const SNAPP_PAY_DEFINITION: ProviderDefinition = {
  provider: 'SNAPP_PAY',
  displayName: SNAPP_PAY_DISPLAY_NAME,
  description: 'خرید اقساطی با اعتبار اسنپ‌پی',
  credentialFields: [
    {
      key: 'clientId',
      label: 'شناسهٔ کلاینت (Client ID)',
      secret: true,
      required: true,
      help: CREDENTIAL_HELP,
    },
    {
      key: 'clientSecret',
      label: 'رمز کلاینت (Client Secret)',
      secret: true,
      required: true,
      help: CREDENTIAL_HELP,
    },
    {
      key: 'username',
      label: 'نام کاربری پذیرنده',
      secret: true,
      required: true,
      help: CREDENTIAL_HELP,
    },
    {
      key: 'password',
      label: 'رمز عبور پذیرنده',
      secret: true,
      required: true,
      help: CREDENTIAL_HELP,
    },
  ],
  settingFields: [
    CONTRACT_DOCS_FIELD,
    AMOUNT_UNIT_FIELD,
    ...baseUrlFields({ production: '', sandbox: '' }),
    pathField(BNPL_PATH_SETTINGS.token, BNPL_PATH_LABELS.token, 'api/online/v1/oauth/token'),
    pathField(
      BNPL_PATH_SETTINGS.paymentToken,
      BNPL_PATH_LABELS.paymentToken,
      'api/online/payment/v1/token',
    ),
    pathField(BNPL_PATH_SETTINGS.verify, BNPL_PATH_LABELS.verify, 'api/online/payment/v1/verify'),
    pathField(BNPL_PATH_SETTINGS.settle, BNPL_PATH_LABELS.settle, 'api/online/payment/v1/settle'),
    pathField(BNPL_PATH_SETTINGS.revert, BNPL_PATH_LABELS.revert, 'api/online/payment/v1/revert'),
  ],
  capabilities: ['create', 'verify', 'settle', 'refund'],
  supportsSandbox: false,
  docsStatus: 'UNVERIFIED',
  minAmount: SNAPP_PAY_MIN_AMOUNT_IRR,
};

export class SnappPayPaymentProvider extends BnplTokenProviderBase {
  readonly name = 'SNAPP_PAY' as const;
  readonly definition = SNAPP_PAY_DEFINITION;

  constructor(context: ProviderContext, http: ProviderHttpClient) {
    super(context, http, SNAPP_PAY_DISPLAY_NAME);
  }

  protected grant(): OAuthPasswordGrant {
    return {
      tokenUrl: this.url('token'),
      clientId: requireCredential(this.context, 'clientId', 'Client ID'),
      clientSecret: requireCredential(this.context, 'clientSecret', 'Client Secret'),
      username: requireCredential(this.context, 'username', 'نام کاربری پذیرنده'),
      password: requireCredential(this.context, 'password', 'رمز عبور پذیرنده'),
    };
  }

  protected buildCreateBody(request: CreatePaymentRequest): Record<string, unknown> {
    // UNVERIFIED: confirm every field name and the basket structure against contract documentation.
    return {
      amount: this.providerAmount(request.amount),
      mobile: request.customer.mobile ?? undefined,
      returnURL: request.callbackUrl,
      transactionId: request.paymentId,
      cartList: [
        {
          cartId: request.orderNumber,
          totalAmount: this.providerAmount(request.amount),
          items: request.items.map((item) => ({
            name: item.title,
            count: item.quantity,
            amount: this.providerAmount(item.unitPrice),
          })),
        },
      ],
    };
  }
}
