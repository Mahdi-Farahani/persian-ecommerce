import type { ProviderHttpClient } from '../provider-http.client.js';
import { fromProviderAmount, parseProviderAmount, toProviderAmount } from '../amount.util.js';
import type { ProviderAmountUnit } from '../amount.util.js';
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

/**
 * ZarinPal REST v4 adapter.
 *
 * Verified against the official SDK sources (github.com/ZarinPal, verified
 * org) on 2026-09-30; see docs/payments/ZARINPAL.md for the evidence table.
 * Endpoints: request.json, verify.json, reverse.json, inquiry.json,
 * feeCalculation.json and StartPay/{authority}. Refunds through the GraphQL
 * API are intentionally not implemented (session lookup unverified).
 */

export const ZARINPAL_DEFINITION: ProviderDefinition = {
  provider: 'ZARINPAL',
  displayName: 'زرین‌پال',
  description: 'پرداخت آنلاین با کارت‌های بانکی عضو شتاب',
  credentialFields: [
    {
      key: 'merchantId',
      label: 'Merchant ID',
      secret: true,
      required: true,
      help: 'شناسهٔ ۳۶ کاراکتری درگاه (UUID) از پنل زرین‌پال؛ در محیط آزمایشی هر UUID پذیرفته می‌شود',
      pattern: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
    },
  ],
  settingFields: [
    {
      key: 'currency',
      label: 'واحد پول ارسالی',
      type: 'select',
      options: [
        { value: 'IRR', label: 'ریال (IRR)' },
        { value: 'IRT', label: 'تومان (IRT)' },
      ],
      defaultValue: 'IRR',
      help: 'مبالغ داخلی ریال هستند؛ در صورت انتخاب تومان به‌صورت خودکار تبدیل می‌شود',
    },
    {
      key: 'productionBaseUrl',
      label: 'آدرس پایهٔ عملیاتی',
      type: 'url',
      defaultValue: 'https://payment.zarinpal.com',
      help: 'در منابع رسمی چند میزبان دیده می‌شود؛ پیش‌فرض همان SDK رسمی است',
    },
  ],
  capabilities: ['create', 'verify', 'reverse', 'inquiry'],
  supportsSandbox: true,
  docsStatus: 'PARTIAL',
  minAmount: 10_000,
};

export const ZARINPAL_SANDBOX_BASE_URL = 'https://sandbox.zarinpal.com';
export const ZARINPAL_PRODUCTION_BASE_URL = 'https://payment.zarinpal.com';
export const ZARINPAL_CODE_OK = 100;
export const ZARINPAL_CODE_ALREADY_VERIFIED = 101;
const AUTHORITY_PATTERN = /^[AS][0-9a-zA-Z]{35}$/;
const MOBILE_PATTERN = /^09[0-9]{9}$/;

/** Statuses reported by inquiry.json. Values other than VERIFIED are not confirmed by official docs. */
const INQUIRY_STATUS_MAP: Record<string, InquiryPaymentResult['status']> = {
  VERIFIED: 'PAID',
  PAID: 'PENDING',
  IN_BANK: 'PENDING',
  FAILED: 'FAILED',
  REVERSED: 'FAILED',
  EXPIRED: 'FAILED',
  TRASH: 'FAILED',
};

interface ZarinPalEnvelope<T> {
  data?: T | [];
  errors?: { code?: number; message?: string; validations?: unknown } | [];
}

interface RequestData {
  code: number;
  message?: string;
  authority?: string;
  fee_type?: string;
  fee?: number;
}

interface VerifyData {
  code: number;
  message?: string;
  ref_id?: number | string;
  card_pan?: string;
  card_hash?: string;
  fee_type?: string;
  fee?: number;
}

interface InquiryData {
  code: number;
  message?: string;
  status?: string;
}

interface FeeData {
  code: number;
  message?: string;
  amount?: number;
  fee?: number;
  fee_type?: string;
}

export class ZarinPalPaymentProvider implements PaymentProvider {
  readonly name = 'ZARINPAL' as const;
  readonly definition = ZARINPAL_DEFINITION;

  constructor(
    private readonly context: ProviderContext,
    private readonly http: ProviderHttpClient,
  ) {}

  get baseUrl(): string {
    if (this.context.environment === 'SANDBOX') return ZARINPAL_SANDBOX_BASE_URL;
    return (this.context.settings.productionBaseUrl || ZARINPAL_PRODUCTION_BASE_URL).replace(
      /\/+$/,
      '',
    );
  }

  get unit(): ProviderAmountUnit {
    return this.context.settings.currency === 'IRT' ? 'IRT' : 'IRR';
  }

  private get merchantId(): string {
    const merchantId = this.context.credentials.merchantId;
    if (!merchantId) {
      throw new PaymentProviderError(
        PaymentErrorCodes.Misconfigured,
        'Merchant ID زرین‌پال تنظیم نشده است',
      );
    }
    return merchantId;
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResult> {
    const metadata: Record<string, string> = { order_id: request.orderNumber };
    if (request.customer.mobile && MOBILE_PATTERN.test(request.customer.mobile)) {
      metadata.mobile = request.customer.mobile;
    }
    if (request.customer.email) metadata.email = request.customer.email;

    const body = {
      merchant_id: this.merchantId,
      amount: toProviderAmount(request.amount, this.unit),
      currency: this.unit,
      callback_url: request.callbackUrl,
      description: request.description,
      metadata,
    };
    const response = await this.http.postJson<ZarinPalEnvelope<RequestData>>(
      `${this.baseUrl}/pg/v4/payment/request.json`,
      body,
      { operation: 'request' },
    );
    const data = this.unwrap(response.data, 'request');
    if (data.code !== ZARINPAL_CODE_OK || !data.authority) {
      throw new PaymentProviderError(
        PaymentErrorCodes.ProviderRejected,
        data.message || 'زرین‌پال درخواست پرداخت را نپذیرفت',
        String(data.code),
        false,
        data,
      );
    }
    return {
      authority: data.authority,
      redirectUrl: `${this.baseUrl}/pg/StartPay/${data.authority}`,
      redirectMethod: 'GET',
      raw: data,
    };
  }

  /** ZarinPal returns the customer with GET ?Authority=...&Status=OK|NOK. */
  parseCallback(payload: CallbackPayload): ParsedCallback {
    const source = { ...payload.body, ...payload.query };
    const authority = pickString(source, ['Authority', 'authority']);
    const status = (pickString(source, ['Status', 'status']) ?? '').toUpperCase();
    return {
      authority: authority && AUTHORITY_PATTERN.test(authority) ? authority : null,
      // NOK covers both cancellation and failure; ZarinPal does not distinguish them.
      outcome: status === 'OK' ? 'OK' : status === 'NOK' ? 'FAILED' : 'UNKNOWN',
      providerTransactionId: null,
      amount: null,
      reference: null,
      raw: source,
    };
  }

  async verifyPayment(request: VerifyPaymentRequest): Promise<VerifyPaymentResult> {
    const response = await this.http.postJson<ZarinPalEnvelope<VerifyData>>(
      `${this.baseUrl}/pg/v4/payment/verify.json`,
      {
        merchant_id: this.merchantId,
        amount: toProviderAmount(request.amount, this.unit),
        authority: request.authority,
      },
      { operation: 'verify' },
    );
    const envelope = response.data;
    const errorCode = envelopeErrorCode(envelope);
    if (errorCode !== null) {
      const message = envelopeErrorMessage(envelope) ?? 'تأیید پرداخت ناموفق بود';
      return {
        status: 'FAILED',
        errorCode: String(errorCode),
        errorMessage: message,
        raw: envelope,
      };
    }
    const data = this.unwrap(envelope, 'verify');
    if (data.code === ZARINPAL_CODE_OK || data.code === ZARINPAL_CODE_ALREADY_VERIFIED) {
      return {
        status: 'PAID',
        providerTransactionId: String(data.ref_id ?? request.authority),
        cardPanMask: data.card_pan ?? null,
        alreadyVerified: data.code === ZARINPAL_CODE_ALREADY_VERIFIED,
        amount: null,
        raw: data,
      };
    }
    return {
      status: 'FAILED',
      errorCode: String(data.code),
      errorMessage: data.message || 'پرداخت تأیید نشد',
      raw: data,
    };
  }

  /** Reverse (reverse.json). Eligibility windows are not documented publicly. */
  async refundPayment(request: RefundPaymentRequest): Promise<OperationResult> {
    const response = await this.http.postJson<ZarinPalEnvelope<{ code: number; message?: string }>>(
      `${this.baseUrl}/pg/v4/payment/reverse.json`,
      { merchant_id: this.merchantId, authority: request.authority },
      { operation: 'reverse' },
    );
    const envelope = response.data;
    const errorCode = envelopeErrorCode(envelope);
    if (errorCode !== null) {
      return {
        succeeded: false,
        providerReference: null,
        errorCode: String(errorCode),
        errorMessage: envelopeErrorMessage(envelope) ?? 'برگشت تراکنش انجام نشد',
        raw: envelope,
      };
    }
    const data = this.unwrap(envelope, 'reverse');
    const ok = data.code === ZARINPAL_CODE_OK;
    return {
      succeeded: ok,
      providerReference: ok ? request.authority : null,
      errorCode: ok ? null : String(data.code),
      errorMessage: ok ? null : data.message || 'برگشت تراکنش انجام نشد',
      raw: data,
    };
  }

  async inquirePayment(request: InquiryPaymentRequest): Promise<InquiryPaymentResult> {
    const response = await this.http.postJson<ZarinPalEnvelope<InquiryData>>(
      `${this.baseUrl}/pg/v4/payment/inquiry.json`,
      { merchant_id: this.merchantId, authority: request.authority },
      { operation: 'inquiry' },
    );
    const envelope = response.data;
    const errorCode = envelopeErrorCode(envelope);
    if (errorCode !== null) {
      return {
        status: 'UNKNOWN',
        providerTransactionId: null,
        errorCode: String(errorCode),
        errorMessage: envelopeErrorMessage(envelope) ?? 'استعلام ناموفق بود',
        raw: envelope,
      };
    }
    const data = this.unwrap(envelope, 'inquiry');
    const status = INQUIRY_STATUS_MAP[(data.status ?? '').toUpperCase()] ?? 'UNKNOWN';
    return {
      status,
      providerTransactionId: null,
      errorCode: status === 'FAILED' ? (data.status ?? null) : null,
      errorMessage: data.message ?? null,
      raw: data,
    };
  }

  /** Fee calculation does not create a transaction; it proves the merchant id is accepted. */
  async testConnection(): Promise<ConnectionTest> {
    const response = await this.http.postJson<ZarinPalEnvelope<FeeData>>(
      `${this.baseUrl}/pg/v4/payment/feeCalculation.json`,
      {
        merchant_id: this.merchantId,
        amount: toProviderAmount(this.definition.minAmount, this.unit),
        currency: this.unit,
      },
      { operation: 'feeCalculation' },
    );
    const envelope = response.data;
    const errorCode = envelopeErrorCode(envelope);
    if (errorCode !== null) {
      return {
        ok: false,
        message:
          `زرین‌پال خطا برگرداند (کد ${errorCode}): ${envelopeErrorMessage(envelope) ?? ''}`.trim(),
        raw: envelope,
      };
    }
    const data = this.unwrap(envelope, 'feeCalculation');
    return {
      ok: data.code === ZARINPAL_CODE_OK,
      message:
        data.code === ZARINPAL_CODE_OK
          ? `اتصال برقرار است (${this.context.environment === 'SANDBOX' ? 'sandbox' : 'production'})`
          : `پاسخ غیرمنتظره (کد ${data.code})`,
      raw: data,
    };
  }

  /** Amount reported by the provider converted back to IRR (used by tests and reconciliation). */
  toInternalAmount(value: unknown): number | null {
    const parsed = parseProviderAmount(value);
    return parsed === null ? null : fromProviderAmount(parsed, this.unit);
  }

  private unwrap<T extends { code: number }>(envelope: ZarinPalEnvelope<T> | null, op: string): T {
    const errorCode = envelopeErrorCode(envelope);
    if (errorCode !== null) {
      throw new PaymentProviderError(
        errorCode === -74 || errorCode === -80
          ? PaymentErrorCodes.InvalidCredentials
          : PaymentErrorCodes.ProviderRejected,
        envelopeErrorMessage(envelope) ?? `زرین‌پال درخواست ${op} را رد کرد`,
        String(errorCode),
        false,
        envelope,
      );
    }
    const data = envelope?.data;
    if (!data || Array.isArray(data) || typeof data.code !== 'number') {
      throw new PaymentProviderError(
        PaymentErrorCodes.InvalidResponse,
        `پاسخ ${op} زرین‌پال ساختار مورد انتظار را ندارد`,
        null,
        false,
        envelope,
      );
    }
    return data;
  }
}

function envelopeErrorCode(envelope: ZarinPalEnvelope<unknown> | null | undefined): number | null {
  const errors = envelope?.errors;
  if (!errors || Array.isArray(errors)) return null;
  return typeof errors.code === 'number' ? errors.code : null;
}

function envelopeErrorMessage(
  envelope: ZarinPalEnvelope<unknown> | null | undefined,
): string | null {
  const errors = envelope?.errors;
  if (!errors || Array.isArray(errors)) return null;
  return typeof errors.message === 'string' ? errors.message : null;
}

function pickString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}
