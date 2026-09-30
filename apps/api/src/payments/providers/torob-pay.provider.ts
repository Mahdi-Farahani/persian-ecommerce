import type {
  CreatePaymentRequest,
  InquiryPaymentRequest,
  InquiryPaymentResult,
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
 * TorobPay (installment / BNPL) adapter — OAuth2 bearer-token REST client.
 *
 * Documentation status: UNVERIFIED. The only official artefact is the
 * WooCommerce plugin listing, which names the production host
 * (cpg.torobpay.com) and confirms that create/status/refund operations exist
 * (research: docs/payments/research/TOROBPAY.md). No endpoint path was
 * published anywhere, so every path setting starts empty and must be filled
 * from the contract documentation (or the plugin source). Field names are
 * UNVERIFIED. `merchantId`/`merchantKey` act as the OAuth client id/secret.
 */

export const TOROB_PAY_DISPLAY_NAME = 'ترب‌پی';
export const TOROB_PAY_PRODUCTION_BASE_URL = 'https://cpg.torobpay.com';

const CREDENTIAL_HELP =
  'نام‌گذاری بر اساس گزارش‌های غیررسمی است؛ با اطلاعات دسترسی‌ای که در پنل پذیرندگان ترب‌پی صادر می‌شود تطبیق دهید';

export const TOROB_PAY_DEFINITION: ProviderDefinition = {
  provider: 'TOROB_PAY',
  displayName: TOROB_PAY_DISPLAY_NAME,
  description: 'خرید اقساطی با ترب‌پی',
  credentialFields: [
    {
      key: 'merchantId',
      label: 'شناسهٔ پذیرنده (Merchant ID)',
      secret: true,
      required: true,
      help: `${CREDENTIAL_HELP}؛ به‌عنوان client id در دریافت توکن استفاده می‌شود`,
    },
    {
      key: 'merchantKey',
      label: 'کلید پذیرنده (Merchant Key)',
      secret: true,
      required: true,
      help: `${CREDENTIAL_HELP}؛ به‌عنوان client secret در دریافت توکن استفاده می‌شود`,
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
    ...baseUrlFields({ production: TOROB_PAY_PRODUCTION_BASE_URL, sandbox: '' }),
    pathField(BNPL_PATH_SETTINGS.token, BNPL_PATH_LABELS.token, ''),
    pathField(BNPL_PATH_SETTINGS.paymentToken, BNPL_PATH_LABELS.paymentToken, ''),
    pathField(BNPL_PATH_SETTINGS.verify, BNPL_PATH_LABELS.verify, ''),
    pathField(BNPL_PATH_SETTINGS.settle, BNPL_PATH_LABELS.settle, ''),
    pathField(BNPL_PATH_SETTINGS.revert, BNPL_PATH_LABELS.revert, ''),
    pathField(BNPL_PATH_SETTINGS.status, BNPL_PATH_LABELS.status, ''),
  ],
  capabilities: ['create', 'verify', 'settle', 'refund', 'inquiry'],
  supportsSandbox: false,
  docsStatus: 'UNVERIFIED',
  minAmount: 1_000_000,
};

export class TorobPayPaymentProvider extends BnplTokenProviderBase {
  readonly name = 'TOROB_PAY' as const;
  readonly definition = TOROB_PAY_DEFINITION;

  constructor(context: ProviderContext, http: ProviderHttpClient) {
    super(context, http, TOROB_PAY_DISPLAY_NAME);
  }

  protected grant(): OAuthPasswordGrant {
    return {
      tokenUrl: this.url('token'),
      clientId: requireCredential(this.context, 'merchantId', 'Merchant ID'),
      clientSecret: requireCredential(this.context, 'merchantKey', 'Merchant Key'),
      username: requireCredential(this.context, 'username', 'نام کاربری پذیرنده'),
      password: requireCredential(this.context, 'password', 'رمز عبور پذیرنده'),
    };
  }

  protected buildCreateBody(request: CreatePaymentRequest): Record<string, unknown> {
    // UNVERIFIED: the plugin listing only says order ids, amounts, currency, line items and
    // customer contact fields are sent; confirm names against contract documentation.
    return {
      amount: this.providerAmount(request.amount),
      currency: this.unit,
      mobile: request.customer.mobile ?? undefined,
      returnURL: request.callbackUrl,
      transactionId: request.paymentId,
      orderId: request.orderNumber,
      items: request.items.map((item) => ({
        name: item.title,
        count: item.quantity,
        amount: this.providerAmount(item.unitPrice),
      })),
    };
  }

  /** The official plugin confirms a status check exists; its path must be configured. */
  inquirePayment(request: InquiryPaymentRequest): Promise<InquiryPaymentResult> {
    return this.inquire(request);
  }
}
