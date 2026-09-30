import { randomBytes } from 'node:crypto';
import type {
  CallbackPayload,
  ConnectionTest,
  CreatePaymentRequest,
  CreatePaymentResult,
  InquiryPaymentRequest,
  InquiryPaymentResult,
  OperationResult,
  ParsedCallback,
  PaymentProvider,
  ProviderContext,
  ProviderDefinition,
  RefundPaymentRequest,
  VerifyPaymentRequest,
  VerifyPaymentResult,
} from '../payment-provider.types.js';
import { PaymentErrorCodes, PaymentProviderError } from '../payment.errors.js';

export const MOCK_DEFINITION: ProviderDefinition = {
  provider: 'MOCK',
  displayName: 'درگاه آزمایشی',
  description: 'پرداخت شبیه‌سازی‌شده برای توسعه و آزمون؛ هیچ مبلغی برداشت نمی‌شود',
  credentialFields: [],
  settingFields: [
    {
      key: 'autoOutcome',
      label: 'نتیجهٔ خودکار',
      type: 'select',
      options: [
        { value: 'interactive', label: 'انتخاب در صفحهٔ درگاه' },
        { value: 'success', label: 'همیشه موفق' },
        { value: 'failure', label: 'همیشه ناموفق' },
      ],
      defaultValue: 'interactive',
      help: 'برای آزمون‌های خودکار می‌توان نتیجه را ثابت کرد',
    },
  ],
  capabilities: ['create', 'verify', 'refund', 'inquiry'],
  supportsSandbox: true,
  docsStatus: 'VERIFIED',
  minAmount: 10_000,
};

export const MOCK_AUTHORITY_PREFIX = 'MOCK-';
/** Amount that the mock declines at verification, to exercise failure paths. */
export const MOCK_DECLINED_AMOUNT = 13_000;

/**
 * In-process gateway used by tests and local development. The "gateway page"
 * is served by the API (see PaymentsController.mockGateway) and returns to the
 * callback with `status=OK|NOK|FAIL`. Verification succeeds only for OK.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'MOCK' as const;
  readonly definition = MOCK_DEFINITION;

  constructor(
    private readonly context: ProviderContext,
    private readonly gatewayUrl: string,
  ) {}

  createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResult> {
    if (request.amount < this.definition.minAmount) {
      return Promise.reject(
        new PaymentProviderError(
          PaymentErrorCodes.ProviderRejected,
          'مبلغ کمتر از حداقل مجاز درگاه است',
          'MOCK_MIN_AMOUNT',
        ),
      );
    }
    const authority = `${MOCK_AUTHORITY_PREFIX}${randomBytes(12).toString('hex')}`;
    const outcome = this.context.settings.autoOutcome ?? 'interactive';
    const url = new URL(this.gatewayUrl);
    url.searchParams.set('authority', authority);
    url.searchParams.set('amount', String(request.amount));
    if (outcome !== 'interactive') url.searchParams.set('auto', outcome);
    return Promise.resolve({
      authority,
      redirectUrl: url.toString(),
      redirectMethod: 'GET',
      raw: { authority, amount: request.amount, requestId: request.requestId },
    });
  }

  parseCallback(payload: CallbackPayload): ParsedCallback {
    const source = payload.method === 'POST' ? payload.body : payload.query;
    const authority = typeof source.authority === 'string' ? source.authority : null;
    const status = typeof source.status === 'string' ? source.status.toUpperCase() : '';
    const outcome =
      status === 'OK'
        ? 'OK'
        : status === 'NOK'
          ? 'CANCELLED'
          : status === 'FAIL'
            ? 'FAILED'
            : 'UNKNOWN';
    return {
      authority,
      outcome,
      providerTransactionId: null,
      amount: null,
      reference: null,
      raw: source,
    };
  }

  verifyPayment(request: VerifyPaymentRequest): Promise<VerifyPaymentResult> {
    if (!request.authority.startsWith(MOCK_AUTHORITY_PREFIX)) {
      return Promise.resolve({
        status: 'FAILED',
        errorCode: 'MOCK_UNKNOWN_AUTHORITY',
        errorMessage: 'شناسهٔ تراکنش نامعتبر است',
        raw: null,
      });
    }
    if (request.amount === MOCK_DECLINED_AMOUNT) {
      return Promise.resolve({
        status: 'FAILED',
        errorCode: 'MOCK_DECLINED',
        errorMessage: 'تراکنش توسط درگاه آزمایشی رد شد',
        raw: { amount: request.amount },
      });
    }
    if (request.callback?.outcome === 'FAILED') {
      return Promise.resolve({
        status: 'FAILED',
        errorCode: 'MOCK_DECLINED',
        errorMessage: 'تراکنش توسط بانک رد شد (شبیه‌سازی)',
        raw: request.callback.raw,
      });
    }
    if (request.callback?.outcome !== 'OK') {
      return Promise.resolve({
        status: 'FAILED',
        errorCode: 'MOCK_NOT_PAID',
        errorMessage: 'پرداخت انجام نشد',
        raw: request.callback?.raw ?? null,
      });
    }
    return Promise.resolve({
      status: 'PAID',
      providerTransactionId: `MOCKREF-${request.authority.slice(-8).toUpperCase()}`,
      cardPanMask: '603799******0001',
      alreadyVerified: false,
      amount: request.amount,
      raw: { authority: request.authority, amount: request.amount, code: 100 },
    });
  }

  refundPayment(request: RefundPaymentRequest): Promise<OperationResult> {
    return Promise.resolve({
      succeeded: true,
      providerReference: `MOCKRFD-${request.providerTransactionId.slice(-6)}`,
      errorCode: null,
      errorMessage: null,
      raw: { amount: request.amount, reason: request.reason },
    });
  }

  inquirePayment(request: InquiryPaymentRequest): Promise<InquiryPaymentResult> {
    return Promise.resolve({
      status: 'UNKNOWN',
      providerTransactionId: null,
      errorCode: null,
      errorMessage: 'درگاه آزمایشی وضعیت مستقلی نگه نمی‌دارد',
      raw: { authority: request.authority },
    });
  }

  testConnection(): Promise<ConnectionTest> {
    return Promise.resolve({ ok: true, message: 'درگاه آزمایشی در دسترس است' });
  }
}
