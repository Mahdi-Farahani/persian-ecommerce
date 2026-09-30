import { fromProviderAmount, parseProviderAmount, toProviderAmount } from '../amount.util.js';
import type { ProviderAmountUnit } from '../amount.util.js';
import type {
  CallbackOutcome,
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
  SettlePaymentRequest,
  VerifyPaymentRequest,
  VerifyPaymentResult,
} from '../payment-provider.types.js';
import { PaymentErrorCodes, PaymentProviderError } from '../payment.errors.js';
import type { ProviderHttpClient } from '../provider-http.client.js';
import {
  amountUnitOf,
  asRecord,
  assertContractDocsConfirmed,
  contractDocsConfirmed,
  isSuccessStatus,
  joinUrl,
  OAuthBearerSession,
  type OAuthPasswordGrant,
  pickRecord,
  pickString,
  redactSensitive,
  requireSetting,
  resolveBaseUrl,
  throwForHttpStatus,
} from './oauth-bearer.support.js';

/**
 * Shared flow for the installment (BNPL) providers whose contracts are not
 * public: OAuth token → payment token → hosted page → verify → settle, with
 * revert and (optionally) status calls. Every path is a setting; the
 * envelope and field names below are UNVERIFIED and annotated as such.
 */

export const BNPL_PATH_SETTINGS = {
  token: 'tokenPath',
  paymentToken: 'paymentTokenPath',
  verify: 'verifyPath',
  settle: 'settlePath',
  revert: 'revertPath',
  status: 'statusPath',
} as const;

export const BNPL_PATH_LABELS: Record<keyof typeof BNPL_PATH_SETTINGS, string> = {
  token: 'مسیر دریافت توکن',
  paymentToken: 'مسیر ایجاد پرداخت (payment token)',
  verify: 'مسیر تأیید پرداخت',
  settle: 'مسیر تسویه (settle)',
  revert: 'مسیر برگشت (revert)',
  status: 'مسیر استعلام وضعیت',
};

/** Response envelope reported for these providers. UNVERIFIED: confirm against contract documentation. */
export interface BnplEnvelope<T> {
  successful?: unknown;
  response?: T;
  errorData?: { errorCode?: unknown; message?: unknown };
}

/** Callback/status words mapped to outcomes. UNVERIFIED: confirm against contract documentation. */
const OUTCOME_WORDS: Record<string, CallbackOutcome> = {
  OK: 'OK',
  SUCCESS: 'OK',
  SUCCESSFUL: 'OK',
  PAID: 'OK',
  VERIFIED: 'OK',
  SETTLED: 'OK',
  FAILED: 'FAILED',
  FAILURE: 'FAILED',
  FAIL: 'FAILED',
  NOK: 'FAILED',
  ERROR: 'FAILED',
  EXPIRED: 'FAILED',
  REVERTED: 'FAILED',
  CANCEL: 'CANCELLED',
  CANCELED: 'CANCELLED',
  CANCELLED: 'CANCELLED',
};

const INQUIRY_STATUS_MAP: Record<string, InquiryPaymentResult['status']> = {
  PAID: 'PAID',
  VERIFIED: 'PAID',
  SETTLED: 'PAID',
  SUCCESS: 'PAID',
  SUCCESSFUL: 'PAID',
  FAILED: 'FAILED',
  FAILURE: 'FAILED',
  CANCELED: 'FAILED',
  CANCELLED: 'FAILED',
  EXPIRED: 'FAILED',
  REVERTED: 'FAILED',
  PENDING: 'PENDING',
  CREATED: 'PENDING',
  IN_PROGRESS: 'PENDING',
  INITIATED: 'PENDING',
};

/** Words reported for an already-verified payment token. UNVERIFIED. */
const ALREADY_VERIFIED_PATTERN = /already|duplicate|verified/i;

interface PaymentTokenData {
  paymentToken?: unknown;
  paymentPageUrl?: unknown;
  transactionId?: unknown;
}

interface VerifyData {
  transactionId?: unknown;
  paymentToken?: unknown;
  amount?: unknown;
  status?: unknown;
}

interface StatusData {
  status?: unknown;
  transactionId?: unknown;
  amount?: unknown;
}

export abstract class BnplTokenProviderBase implements PaymentProvider {
  abstract readonly name: PaymentProvider['name'];
  abstract readonly definition: ProviderDefinition;
  protected readonly session: OAuthBearerSession;

  protected constructor(
    protected readonly context: ProviderContext,
    protected readonly http: ProviderHttpClient,
    protected readonly displayName: string,
  ) {
    this.session = new OAuthBearerSession(http, displayName, () => this.grant());
  }

  /** Maps the provider's credential fields onto the OAuth password grant. */
  protected abstract grant(): OAuthPasswordGrant;

  /** Provider-specific create body; the base adds nothing. */
  protected abstract buildCreateBody(request: CreatePaymentRequest): Record<string, unknown>;

  get baseUrl(): string {
    return resolveBaseUrl(this.context, this.displayName);
  }

  get unit(): ProviderAmountUnit {
    return amountUnitOf(this.context);
  }

  protected get secrets(): string[] {
    return Object.values(this.context.credentials);
  }

  protected url(operation: keyof typeof BNPL_PATH_SETTINGS): string {
    const path = requireSetting(
      this.context,
      BNPL_PATH_SETTINGS[operation],
      BNPL_PATH_LABELS[operation],
    );
    return joinUrl(this.baseUrl, path);
  }

  protected providerAmount(amountIrr: number): number {
    return toProviderAmount(amountIrr, this.unit);
  }

  protected internalAmount(value: unknown): number | null {
    const parsed = parseProviderAmount(value);
    return parsed === null ? null : fromProviderAmount(parsed, this.unit);
  }

  private async post<T>(
    operation: keyof typeof BNPL_PATH_SETTINGS,
    body: unknown,
  ): Promise<{ status: number; envelope: BnplEnvelope<T>; raw: unknown }> {
    const url = this.url(operation);
    const response = await this.session.authorized(operation, (headers) =>
      this.http.postJson<BnplEnvelope<T>>(url, body, { operation, headers }),
    );
    // Parse the redacted copy so provider messages can never carry echoed credentials.
    const envelope = redactSensitive(asRecord(response.data), this.secrets) as BnplEnvelope<T>;
    return { status: response.status, envelope, raw: envelope };
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResult> {
    assertContractDocsConfirmed(this.context, this.displayName);
    const { status, envelope, raw } = await this.post<PaymentTokenData>(
      'paymentToken',
      this.buildCreateBody(request),
    );
    const failure = declineOf(envelope);
    if (failure) {
      if (!isSuccessStatus(status) && failure.code === null) {
        throwForHttpStatus(status, 'paymentToken', this.displayName, raw);
      }
      throw new PaymentProviderError(
        PaymentErrorCodes.ProviderRejected,
        failure.message ?? `${this.displayName} درخواست پرداخت را نپذیرفت`,
        failure.code,
        false,
        raw,
      );
    }
    const data = asRecord(envelope.response);
    // UNVERIFIED: confirm response field names against contract documentation.
    const paymentToken = pickString(data, ['paymentToken', 'token']);
    const pageUrl = pickString(data, ['paymentPageUrl', 'paymentUrl', 'redirectUrl']);
    if (!paymentToken || !pageUrl) {
      throw new PaymentProviderError(
        PaymentErrorCodes.InvalidResponse,
        `پاسخ ایجاد پرداخت ${this.displayName} فاقد paymentToken یا آدرس صفحهٔ پرداخت است`,
        null,
        false,
        raw,
      );
    }
    return { authority: paymentToken, redirectUrl: pageUrl, redirectMethod: 'GET', raw };
  }

  /**
   * The hosted page is expected to return with the payment token, our
   * transaction id and a state word (UNVERIFIED). Body values win over query
   * values so both GET and POST returns are accepted.
   */
  parseCallback(payload: CallbackPayload): ParsedCallback {
    const source = { ...payload.query, ...payload.body };
    const raw = redactSensitive(source, this.secrets) as Record<string, unknown>;
    // UNVERIFIED: confirm callback parameter names against contract documentation.
    const paymentToken = pickString(source, ['paymentToken', 'token']);
    const transactionId = pickString(source, ['transactionId', 'transaction_id']);
    const state = pickString(source, ['state', 'status', 'result']);
    const amount = this.internalAmount(source.amount);
    return {
      authority: paymentToken,
      outcome: (state ? OUTCOME_WORDS[state.toUpperCase()] : undefined) ?? 'UNKNOWN',
      providerTransactionId: null,
      amount,
      reference: transactionId,
      raw,
    };
  }

  async verifyPayment(request: VerifyPaymentRequest): Promise<VerifyPaymentResult> {
    const { status, envelope, raw } = await this.post<VerifyData>('verify', {
      // UNVERIFIED: confirm field names against contract documentation.
      paymentToken: request.authority,
    });
    if (status >= 500) throwForHttpStatus(status, 'verify', this.displayName, raw);
    const failure = declineOf(envelope);
    if (failure) {
      return {
        status: 'FAILED',
        errorCode: failure.code ?? String(status),
        errorMessage: failure.message ?? `${this.displayName} پرداخت را تأیید نکرد`,
        raw,
      };
    }
    const data = asRecord(envelope.response);
    const state = pickString(data, ['status', 'state']);
    if (state && OUTCOME_WORDS[state.toUpperCase()] === 'FAILED') {
      return {
        status: 'FAILED',
        errorCode: state.toUpperCase(),
        errorMessage: `${this.displayName} وضعیت پرداخت را ${state} اعلام کرد`,
        raw,
      };
    }
    return {
      status: 'PAID',
      providerTransactionId:
        pickString(data, ['transactionId', 'paymentToken']) ?? request.authority,
      cardPanMask: null,
      alreadyVerified: state !== null && ALREADY_VERIFIED_PATTERN.test(state),
      amount: this.internalAmount(data.amount),
      raw,
    };
  }

  /** BNPL settle/capture after a successful verify. */
  async settlePayment(request: SettlePaymentRequest): Promise<OperationResult> {
    return this.operation('settle', {
      // UNVERIFIED: confirm field names against contract documentation.
      paymentToken: request.authority,
    });
  }

  /** Revert (cancel/refund) of a payment token. Post-settlement support is UNVERIFIED. */
  async refundPayment(request: RefundPaymentRequest): Promise<OperationResult> {
    return this.operation('revert', {
      // UNVERIFIED: confirm field names against contract documentation.
      paymentToken: request.authority,
      amount: this.providerAmount(request.amount),
      description: request.reason ?? undefined,
    });
  }

  protected async inquire(request: InquiryPaymentRequest): Promise<InquiryPaymentResult> {
    const { status, envelope, raw } = await this.post<StatusData>('status', {
      // UNVERIFIED: confirm field names against contract documentation.
      paymentToken: request.authority,
    });
    if (status >= 500) throwForHttpStatus(status, 'status', this.displayName, raw);
    const failure = declineOf(envelope);
    if (failure) {
      return {
        status: 'UNKNOWN',
        providerTransactionId: null,
        errorCode: failure.code ?? String(status),
        errorMessage: failure.message ?? 'استعلام ناموفق بود',
        raw,
      };
    }
    const data = asRecord(envelope.response);
    const word = (pickString(data, ['status', 'state']) ?? '').toUpperCase();
    const mapped = INQUIRY_STATUS_MAP[word] ?? 'UNKNOWN';
    return {
      status: mapped,
      providerTransactionId: pickString(data, ['transactionId']),
      errorCode: mapped === 'FAILED' ? word : null,
      errorMessage: null,
      raw,
    };
  }

  /** Only the token exchange is exercised; no payment is created. */
  async testConnection(): Promise<ConnectionTest> {
    await this.session.accessToken(true);
    const environment = this.context.environment === 'SANDBOX' ? 'sandbox' : 'production';
    return {
      ok: true,
      message: contractDocsConfirmed(this.context)
        ? `اتصال برقرار است و توکن دریافت شد (${environment})`
        : `توکن دریافت شد (${environment})؛ هشدار: مطابقت با مستندات قرارداد هنوز تأیید نشده و ایجاد پرداخت غیرفعال است`,
    };
  }

  private async operation(
    operation: 'settle' | 'revert',
    body: Record<string, unknown>,
  ): Promise<OperationResult> {
    const { status, envelope, raw } = await this.post<{ transactionId?: unknown }>(operation, body);
    if (status >= 500) throwForHttpStatus(status, operation, this.displayName, raw);
    const failure = declineOf(envelope);
    if (failure) {
      return {
        succeeded: false,
        providerReference: null,
        errorCode: failure.code ?? String(status),
        errorMessage: failure.message ?? `${this.displayName} عملیات ${operation} را نپذیرفت`,
        raw,
      };
    }
    const data = asRecord(envelope.response);
    return {
      succeeded: true,
      providerReference: pickString(data, ['transactionId', 'paymentToken']),
      errorCode: null,
      errorMessage: null,
      raw,
    };
  }
}

/** Null when the envelope reports success; otherwise the reported code/message. */
function declineOf(
  envelope: BnplEnvelope<unknown>,
): { code: string | null; message: string | null } | null {
  if (envelope.successful === true) return null;
  const errorData = pickRecord(envelope as Record<string, unknown>, ['errorData', 'error']);
  const code = errorData ? pickString(errorData, ['errorCode', 'code']) : null;
  const message = errorData ? pickString(errorData, ['message', 'errorMessage']) : null;
  if (envelope.successful === undefined && !errorData && envelope.response !== undefined) {
    // Tolerate envelopes without the `successful` flag when a response body is present.
    return null;
  }
  return { code, message };
}
