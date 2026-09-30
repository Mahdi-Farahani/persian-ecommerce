import { fromProviderAmount, parseProviderAmount, toProviderAmount } from '../amount.util.js';
import type { ProviderAmountUnit } from '../amount.util.js';
import type {
  CallbackOutcome,
  CallbackPayload,
  ConnectionTest,
  CreatePaymentRequest,
  CreatePaymentResult,
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
import type { ProviderHttpClient } from '../provider-http.client.js';
import {
  AMOUNT_UNIT_FIELD,
  amountUnitOf,
  asRecord,
  assertContractDocsConfirmed,
  baseUrlFields,
  CONTRACT_DOCS_FIELD,
  contractDocsConfirmed,
  isSuccessStatus,
  joinUrl,
  OAuthBearerSession,
  pathField,
  pickRecord,
  pickString,
  redactSensitive,
  requireCredential,
  requireSetting,
  resolveBaseUrl,
  throwForHttpStatus,
} from './oauth-bearer.support.js';

/**
 * DigiPay (UPG) adapter — OAuth2 bearer-token REST client.
 *
 * Documentation status: PARTIAL. The official docs page
 * (mydigipay.com/developers/docs/upg) was unreachable on 2026-09-30; the only
 * confirmed facts come from search-engine excerpts of that page (SNIPPET):
 * headers `Agent: WEB` and `Digipay-Version: 2022-02-02`, HTTP 401 for an
 * expired/invalid token, a `payUrl` in the ticket response, a POST callback
 * carrying `amount` and `providerId` that must be re-checked before verify,
 * and a 25-minute post-confirmation reversal window. Every path and field
 * marked UNVERIFIED must be confirmed against the contract documentation;
 * paths are settings so they can be corrected without a code change. See
 * docs/payments/DIGIPAY.md.
 */

export const DIGIPAY_DISPLAY_NAME = 'دیجی‌پی';
export const DIGIPAY_PRODUCTION_BASE_URL = 'https://api.mydigipay.com/digipay/api';
export const DIGIPAY_SANDBOX_BASE_URL = 'https://uat.mydigipay.info/digipay/api';
/** SNIPPET-confirmed request headers. */
export const DIGIPAY_AGENT_HEADER = 'WEB';
export const DIGIPAY_VERSION_HEADER = '2022-02-02';
/** SNIPPET-confirmed: a confirmed purchase can be reversed within this window. */
export const DIGIPAY_REVERSAL_WINDOW_MINUTES = 25;

const SETTING_TOKEN_PATH = 'tokenPath';
const SETTING_TICKET_PATH = 'ticketPath';
const SETTING_TICKET_TYPE = 'ticketType';
const SETTING_VERIFY_PATH = 'verifyPath';
const SETTING_REFUND_PATH = 'refundPath';
const TRACKING_CODE_PLACEHOLDER = '{trackingCode}';

export const DIGIPAY_DEFINITION: ProviderDefinition = {
  provider: 'DIGIPAY',
  displayName: DIGIPAY_DISPLAY_NAME,
  description: 'پرداخت با کیف پول، اعتبار یا درگاه دیجی‌پی',
  credentialFields: [
    {
      key: 'clientId',
      label: 'شناسهٔ کلاینت (Client ID)',
      secret: true,
      required: true,
      help: 'نام‌گذاری بر اساس گزارش‌های غیررسمی است؛ با اطلاعات دسترسی صادرشده توسط دیجی‌پی تطبیق دهید',
    },
    {
      key: 'clientSecret',
      label: 'رمز کلاینت (Client Secret)',
      secret: true,
      required: true,
      help: 'نام‌گذاری بر اساس گزارش‌های غیررسمی است؛ با اطلاعات دسترسی صادرشده توسط دیجی‌پی تطبیق دهید',
    },
    {
      key: 'username',
      label: 'نام کاربری پذیرنده',
      secret: true,
      required: true,
      help: 'نام کاربری OAuth (password grant) طبق گزارش‌های غیررسمی؛ با اطلاعات دسترسی صادرشده تطبیق دهید',
    },
    {
      key: 'password',
      label: 'رمز عبور پذیرنده',
      secret: true,
      required: true,
      help: 'رمز عبور OAuth (password grant) طبق گزارش‌های غیررسمی؛ با اطلاعات دسترسی صادرشده تطبیق دهید',
    },
  ],
  settingFields: [
    CONTRACT_DOCS_FIELD,
    AMOUNT_UNIT_FIELD,
    ...baseUrlFields({
      production: DIGIPAY_PRODUCTION_BASE_URL,
      sandbox: DIGIPAY_SANDBOX_BASE_URL,
    }),
    pathField(SETTING_TOKEN_PATH, 'مسیر دریافت توکن', 'oauth/token'),
    pathField(SETTING_TICKET_PATH, 'مسیر ایجاد تیکت خرید', 'tickets/business'),
    {
      key: SETTING_TICKET_TYPE,
      label: 'نوع تیکت (پارامتر type)',
      type: 'text',
      defaultValue: '',
      help: 'محصول دیجی‌پی (کیف پول / درگاه / اعتباری) با پارامتر type انتخاب می‌شود. مقادیر مجاز در مستندات عمومی تأیید نشده‌اند؛ از مستندات قرارداد وارد کنید. اگر خالی باشد پارامتر ارسال نمی‌شود.',
    },
    pathField(
      SETTING_VERIFY_PATH,
      'مسیر تأیید خرید',
      `purchases/verify/${TRACKING_CODE_PLACEHOLDER}`,
    ),
    pathField(SETTING_REFUND_PATH, 'مسیر برگشت/بازپرداخت', 'refunds'),
  ],
  capabilities: ['create', 'verify', 'refund'],
  supportsSandbox: true,
  docsStatus: 'PARTIAL',
  minAmount: 10_000,
};

/** Callback/verify status words mapped to outcomes. UNVERIFIED: confirm against contract documentation. */
const OUTCOME_WORDS: Record<string, CallbackOutcome> = {
  SUCCESS: 'OK',
  SUCCESSFUL: 'OK',
  OK: 'OK',
  PAID: 'OK',
  '0': 'OK',
  FAILED: 'FAILED',
  FAILURE: 'FAILED',
  FAIL: 'FAILED',
  NOK: 'FAILED',
  ERROR: 'FAILED',
  CANCEL: 'CANCELLED',
  CANCELED: 'CANCELLED',
  CANCELLED: 'CANCELLED',
};

/** Shape reported for DigiPay responses. UNVERIFIED: confirm against contract documentation. */
interface DigiPayResult {
  status?: unknown;
  message?: unknown;
  title?: unknown;
  level?: unknown;
}

interface TicketResponse {
  payUrl?: unknown; // SNIPPET-confirmed name
  ticket?: unknown; // UNVERIFIED
  trackingCode?: unknown; // UNVERIFIED
  result?: DigiPayResult;
}

interface VerifyResponse {
  result?: DigiPayResult;
  trackingCode?: unknown;
  amount?: unknown;
  providerId?: unknown;
  rrn?: unknown;
  paymentGateway?: unknown;
  paymentResult?: unknown;
}

export class DigiPayPaymentProvider implements PaymentProvider {
  readonly name = 'DIGIPAY' as const;
  readonly definition = DIGIPAY_DEFINITION;
  private readonly session: OAuthBearerSession;

  constructor(
    private readonly context: ProviderContext,
    private readonly http: ProviderHttpClient,
  ) {
    this.session = new OAuthBearerSession(http, DIGIPAY_DISPLAY_NAME, () => ({
      tokenUrl: this.url(SETTING_TOKEN_PATH, 'مسیر دریافت توکن'),
      clientId: requireCredential(context, 'clientId', 'Client ID'),
      clientSecret: requireCredential(context, 'clientSecret', 'Client Secret'),
      username: requireCredential(context, 'username', 'نام کاربری پذیرنده'),
      password: requireCredential(context, 'password', 'رمز عبور پذیرنده'),
      headers: DIGIPAY_HEADERS,
    }));
  }

  get baseUrl(): string {
    return resolveBaseUrl(this.context, DIGIPAY_DISPLAY_NAME);
  }

  get unit(): ProviderAmountUnit {
    return amountUnitOf(this.context);
  }

  /** Provider payloads are parsed from a redacted copy so echoed credentials never reach messages or raw. */
  private redacted(body: unknown): Record<string, unknown> {
    return redactSensitive(asRecord(body), Object.values(this.context.credentials)) as Record<
      string,
      unknown
    >;
  }

  private url(
    settingKey: string,
    label: string,
    replacements: Record<string, string> = {},
  ): string {
    let path = requireSetting(this.context, settingKey, label);
    for (const [placeholder, value] of Object.entries(replacements)) {
      path = path.replace(placeholder, encodeURIComponent(value));
    }
    const type = (this.context.settings[SETTING_TICKET_TYPE] ?? '').trim();
    // UNVERIFIED: `type` selects the product (wallet/IPG/credit) and is reported as required on every call.
    return joinUrl(this.baseUrl, path, settingKey === SETTING_TOKEN_PATH ? {} : { type });
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResult> {
    assertContractDocsConfirmed(this.context, DIGIPAY_DISPLAY_NAME);
    const url = this.url(SETTING_TICKET_PATH, 'مسیر ایجاد تیکت خرید');
    const body = {
      // UNVERIFIED: confirm field names against contract documentation.
      amount: toProviderAmount(request.amount, this.unit),
      cellNumber: request.customer.mobile ?? undefined,
      // SNIPPET-confirmed: providerId is the merchant's unique purchase id, echoed in the callback.
      providerId: request.paymentId,
      redirectUrl: request.callbackUrl,
      callbackUrl: request.callbackUrl,
      description: request.description,
    };
    const response = await this.session.authorized('ticket', (headers) =>
      this.http.postJson<TicketResponse>(url, body, {
        operation: 'ticket',
        headers: { ...DIGIPAY_HEADERS, ...headers },
      }),
    );
    const data = this.redacted(response.data) as TicketResponse;
    const raw: unknown = data;
    const payUrl = typeof data.payUrl === 'string' ? data.payUrl : null;
    if (!isSuccessStatus(response.status) || !payUrl) {
      const result = resultOf(data);
      if (result.code !== null && !result.ok) {
        throw new PaymentProviderError(
          PaymentErrorCodes.ProviderRejected,
          result.message ?? 'دیجی‌پی درخواست ایجاد تیکت را نپذیرفت',
          result.code,
          false,
          raw,
        );
      }
      if (!isSuccessStatus(response.status)) {
        throwForHttpStatus(response.status, 'ticket', DIGIPAY_DISPLAY_NAME, raw);
      }
      throw new PaymentProviderError(
        PaymentErrorCodes.InvalidResponse,
        'پاسخ ایجاد تیکت دیجی‌پی فاقد payUrl است',
        null,
        false,
        raw,
      );
    }
    // The tracking code (when returned) is the id verify needs; otherwise our own providerId
    // is the reference DigiPay echoes back, so it is the safest stable authority.
    const authority =
      pickString(data as Record<string, unknown>, ['trackingCode', 'ticket']) ?? request.paymentId;
    return { authority, redirectUrl: payUrl, redirectMethod: 'GET', raw };
  }

  /**
   * DigiPay POSTs the result to the merchant redirect URL (SNIPPET); GET is
   * accepted as well. `amount` and `providerId` are surfaced so the caller
   * can re-check them before verification, as the official docs instruct.
   * The tracking code is reported as providerTransactionId rather than as the
   * authority because the create response may not have contained it.
   */
  parseCallback(payload: CallbackPayload): ParsedCallback {
    const source = { ...payload.query, ...payload.body };
    const raw = this.redacted(source);
    // UNVERIFIED: confirm callback field names against contract documentation.
    const trackingCode = pickString(source, ['trackingCode', 'tracking_code']);
    const providerId = pickString(source, ['providerId', 'provider_id']);
    const amount = parseProviderAmount(source.amount);
    // `result` may be a word or the `{ status, message }` block used by verify responses.
    const resultBlock = pickRecord(source, ['result']);
    const status =
      (resultBlock ? pickString(resultBlock, ['status']) : null) ??
      pickString(source, ['result', 'status', 'paymentResult']);
    const outcome: CallbackOutcome =
      (status ? OUTCOME_WORDS[status.toUpperCase()] : undefined) ?? 'UNKNOWN';
    return {
      authority: null,
      outcome,
      providerTransactionId: trackingCode,
      amount: amount === null ? null : fromProviderAmount(amount, this.unit),
      reference: providerId,
      raw,
    };
  }

  async verifyPayment(request: VerifyPaymentRequest): Promise<VerifyPaymentResult> {
    const trackingCode = request.callback?.providerTransactionId ?? request.authority;
    const url = this.url(SETTING_VERIFY_PATH, 'مسیر تأیید خرید', {
      [TRACKING_CODE_PLACEHOLDER]: trackingCode,
    });
    const response = await this.session.authorized('verify', (headers) =>
      // UNVERIFIED: verify is reported as a POST with an empty body.
      this.http.postJson<VerifyResponse>(
        url,
        {},
        {
          operation: 'verify',
          headers: { ...DIGIPAY_HEADERS, ...headers },
        },
      ),
    );
    const data = this.redacted(response.data) as VerifyResponse;
    const raw: unknown = data;
    const result = resultOf(data);
    if (response.status >= 500) {
      throwForHttpStatus(response.status, 'verify', DIGIPAY_DISPLAY_NAME, raw);
    }
    if (!isSuccessStatus(response.status) || !result.ok) {
      return {
        status: 'FAILED',
        errorCode: result.code ?? String(response.status),
        errorMessage: result.message ?? 'دیجی‌پی پرداخت را تأیید نکرد',
        raw,
      };
    }
    const echoedProviderId = pickString(data as Record<string, unknown>, ['providerId']);
    if (echoedProviderId && echoedProviderId !== request.paymentId) {
      return {
        status: 'FAILED',
        errorCode: PaymentErrorCodes.TransactionMismatch,
        errorMessage: 'شناسهٔ خرید اعلام‌شده توسط دیجی‌پی با این پرداخت مطابقت ندارد',
        raw,
      };
    }
    const confirmed = parseProviderAmount(data.amount);
    return {
      status: 'PAID',
      providerTransactionId:
        pickString(data as Record<string, unknown>, ['trackingCode']) ?? trackingCode,
      cardPanMask: null,
      // UNVERIFIED: DigiPay's signal for an already-verified purchase is not documented.
      alreadyVerified: false,
      amount: confirmed === null ? null : fromProviderAmount(confirmed, this.unit),
      raw,
    };
  }

  /**
   * Reversal/refund of a confirmed purchase. The official docs confirm only
   * that a reversal is possible within 25 minutes of confirmation; the
   * endpoint and body are UNVERIFIED. Later refunds must be handled through
   * DigiPay's business panel until the refund API is confirmed.
   */
  async refundPayment(request: RefundPaymentRequest): Promise<OperationResult> {
    const url = this.url(SETTING_REFUND_PATH, 'مسیر برگشت/بازپرداخت');
    const body = {
      // UNVERIFIED: confirm field names against contract documentation.
      trackingCode: request.providerTransactionId,
      providerId: request.paymentId,
      amount: toProviderAmount(request.amount, this.unit),
      description: request.reason ?? undefined,
    };
    const response = await this.session.authorized('refund', (headers) =>
      this.http.postJson<{ result?: DigiPayResult }>(url, body, {
        operation: 'refund',
        headers: { ...DIGIPAY_HEADERS, ...headers },
      }),
    );
    const data = this.redacted(response.data);
    const raw: unknown = data;
    if (response.status >= 500) {
      throwForHttpStatus(response.status, 'refund', DIGIPAY_DISPLAY_NAME, raw);
    }
    const result = resultOf(data);
    const ok = isSuccessStatus(response.status) && result.ok;
    return {
      succeeded: ok,
      providerReference: ok ? request.providerTransactionId : null,
      errorCode: ok ? null : (result.code ?? String(response.status)),
      errorMessage: ok
        ? null
        : (result.message ??
          `دیجی‌پی برگشت تراکنش را نپذیرفت (برگشت فقط تا ${DIGIPAY_REVERSAL_WINDOW_MINUTES} دقیقه پس از تأیید ممکن است)`),
      raw,
    };
  }

  /** Only the token exchange is exercised; no ticket is created. */
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
}

const DIGIPAY_HEADERS: Record<string, string> = {
  Agent: DIGIPAY_AGENT_HEADER,
  'Digipay-Version': DIGIPAY_VERSION_HEADER,
};

/** Reads the reported `result: { status, message }` block. UNVERIFIED: status 0 is assumed to mean success. */
function resultOf(data: { result?: DigiPayResult }): {
  ok: boolean;
  code: string | null;
  message: string | null;
} {
  const result = pickRecord(data, ['result']);
  if (!result) return { ok: true, code: null, message: null };
  const status = result.status;
  const code = typeof status === 'number' || typeof status === 'string' ? String(status) : null;
  const message = typeof result.message === 'string' ? result.message : null;
  const ok = code === null || code === '0' || OUTCOME_WORDS[code.toUpperCase()] === 'OK';
  return { ok, code, message };
}
