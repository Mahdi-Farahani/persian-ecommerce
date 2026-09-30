import type { ProviderAmountUnit } from '../amount.util.js';
import type { ProviderContext, ProviderSettingField } from '../payment-provider.types.js';
import { PaymentErrorCodes, PaymentProviderError } from '../payment.errors.js';
import type { HttpJsonResponse, ProviderHttpClient } from '../provider-http.client.js';

/**
 * Shared building blocks for the OAuth2 (password grant + bearer token)
 * adapters whose official documentation could not be reached (SnappPay,
 * DigiPay, TorobPay). Everything an operator may need to correct after
 * receiving the contract documentation lives in settings; only the shape of
 * the token exchange (RFC 6749 §4.3) is assumed here.
 */

export const CONTRACT_DOCS_CONFIRMED_KEY = 'contractDocsConfirmed';
export const AMOUNT_UNIT_KEY = 'amountUnit';
export const PRODUCTION_BASE_URL_KEY = 'productionBaseUrl';
export const SANDBOX_BASE_URL_KEY = 'sandboxBaseUrl';

export const CONTRACT_DOCS_FIELD: ProviderSettingField = {
  key: CONTRACT_DOCS_CONFIRMED_KEY,
  label: 'تأیید مطابقت با مستندات قرارداد',
  type: 'select',
  options: [
    { value: 'no', label: 'خیر — هنوز بررسی نشده' },
    { value: 'yes', label: 'بله — آدرس‌ها و فیلدها با مستندات قرارداد مطابقت داده شد' },
  ],
  defaultValue: 'no',
  help: 'مستندات عمومی این درگاه در دسترس نبود. آدرس سرویس‌ها، مسیرها و نام فیلدهای این اتصال باید با مستندات فنی‌ای که همراه قرارداد پذیرندگی تحویل می‌شود مطابقت داده و در صورت نیاز در همین صفحه اصلاح شود. تا زمانی که این گزینه «بله» نباشد، ایجاد پرداخت انجام نمی‌شود (آزمون اتصال همچنان کار می‌کند).',
};

export const AMOUNT_UNIT_FIELD: ProviderSettingField = {
  key: AMOUNT_UNIT_KEY,
  label: 'واحد مبلغ ارسالی',
  type: 'select',
  options: [
    { value: 'IRR', label: 'ریال (IRR)' },
    { value: 'IRT', label: 'تومان (IRT)' },
  ],
  defaultValue: 'IRR',
  help: 'مبالغ داخلی ریال هستند؛ در صورت انتخاب تومان به‌صورت خودکار تبدیل می‌شود. واحد مورد انتظار درگاه در مستندات عمومی تأیید نشده است.',
};

export function baseUrlFields(defaults: {
  production: string;
  sandbox: string;
}): ProviderSettingField[] {
  return [
    {
      key: PRODUCTION_BASE_URL_KEY,
      label: 'آدرس پایهٔ عملیاتی',
      type: 'url',
      defaultValue: defaults.production,
      help: defaults.production
        ? 'مقدار پیش‌فرض از منابع غیررسمی گزارش شده و باید با مستندات قرارداد تأیید شود'
        : 'در هیچ منبع رسمی منتشر نشده است؛ از مستندات قرارداد وارد کنید',
    },
    {
      key: SANDBOX_BASE_URL_KEY,
      label: 'آدرس پایهٔ آزمایشی',
      type: 'url',
      defaultValue: defaults.sandbox,
      help: defaults.sandbox
        ? 'مقدار پیش‌فرض از منابع غیررسمی گزارش شده و باید با مستندات قرارداد تأیید شود'
        : 'وجود محیط آزمایشی در منابع رسمی تأیید نشده است؛ در صورت وجود از مستندات قرارداد وارد کنید',
    },
  ];
}

/** Text setting for one endpoint path; an absolute URL is also accepted (other host). */
export function pathField(key: string, label: string, defaultValue: string): ProviderSettingField {
  return {
    key,
    label,
    type: 'text',
    defaultValue,
    help: defaultValue
      ? `مسیر نسبت به آدرس پایه (یا آدرس کامل). پیش‌فرض «${defaultValue}» تأییدنشده است`
      : 'مسیر نسبت به آدرس پایه (یا آدرس کامل). در هیچ منبعی منتشر نشده؛ از مستندات قرارداد وارد کنید',
  };
}

export function contractDocsConfirmed(context: ProviderContext): boolean {
  return context.settings[CONTRACT_DOCS_CONFIRMED_KEY] === 'yes';
}

export function assertContractDocsConfirmed(context: ProviderContext, displayName: string): void {
  if (!contractDocsConfirmed(context)) {
    throw new PaymentProviderError(
      PaymentErrorCodes.Misconfigured,
      `اتصال ${displayName} هنوز با مستندات قرارداد مطابقت داده نشده است؛ پس از بررسی، گزینهٔ «تأیید مطابقت با مستندات قرارداد» را در تنظیمات درگاه فعال کنید`,
    );
  }
}

export function amountUnitOf(context: ProviderContext): ProviderAmountUnit {
  return context.settings[AMOUNT_UNIT_KEY] === 'IRT' ? 'IRT' : 'IRR';
}

export function resolveBaseUrl(context: ProviderContext, displayName: string): string {
  const key = context.environment === 'SANDBOX' ? SANDBOX_BASE_URL_KEY : PRODUCTION_BASE_URL_KEY;
  const value = (context.settings[key] ?? '').trim();
  if (!value) {
    throw new PaymentProviderError(
      PaymentErrorCodes.Misconfigured,
      `آدرس پایهٔ ${context.environment === 'SANDBOX' ? 'آزمایشی' : 'عملیاتی'} ${displayName} تنظیم نشده است`,
    );
  }
  return value.replace(/\/+$/, '');
}

export function requireSetting(context: ProviderContext, key: string, label: string): string {
  const value = (context.settings[key] ?? '').trim();
  if (!value) {
    throw new PaymentProviderError(
      PaymentErrorCodes.Misconfigured,
      `تنظیم «${label}» برای این درگاه مقداردهی نشده است`,
    );
  }
  return value;
}

export function requireCredential(context: ProviderContext, key: string, label: string): string {
  const value = context.credentials[key];
  if (!value) {
    throw new PaymentProviderError(
      PaymentErrorCodes.Misconfigured,
      `«${label}» برای این درگاه تنظیم نشده است`,
    );
  }
  return value;
}

/** Joins a base URL and a relative path (or returns the path when it is already absolute). */
export function joinUrl(base: string, path: string, query?: Record<string, string>): string {
  const absolute = /^https?:\/\//i.test(path) ? path : `${base}/${path.replace(/^\/+/, '')}`;
  const url = new URL(absolute);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== '') url.searchParams.set(key, value);
  }
  return url.toString();
}

export function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

const SENSITIVE_KEY_PATTERN =
  /^(access_token|refresh_token|id_token|token|password|client_secret|secret|authorization|merchantkey|merchant_key)$/i;
const REDACTED = '[redacted]';

/**
 * Deep-copies a provider payload for logging/persistence with credential-like
 * keys removed and any string containing a known secret value replaced. Used
 * for every `raw` that leaves an adapter.
 */
export function redactSensitive(value: unknown, secrets: readonly string[] = []): unknown {
  const live = secrets.filter((s) => s.length > 0);
  const visit = (node: unknown, depth: number): unknown => {
    if (depth > 8) return REDACTED;
    if (typeof node === 'string') {
      return live.some((s) => node.includes(s)) ? REDACTED : node;
    }
    if (Array.isArray(node)) return node.map((item) => visit(item, depth + 1));
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(node as Record<string, unknown>)) {
        out[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : visit(item, depth + 1);
      }
      return out;
    }
    return node;
  };
  return visit(value, 0);
}

export function pickString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.length > 0) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

export function pickRecord(
  source: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> | null {
  for (const key of keys) {
    const value = source[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return null;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Maps a non-2xx status that is not a business decline to a transport-level error. */
export function throwForHttpStatus(
  status: number,
  operation: string,
  displayName: string,
  raw: unknown,
): never {
  if (status === 401 || status === 403) {
    throw new PaymentProviderError(
      PaymentErrorCodes.InvalidCredentials,
      `${displayName} دسترسی ${operation} را نپذیرفت؛ اطلاعات ورود را بررسی کنید`,
      String(status),
      false,
      raw,
    );
  }
  if (status >= 500) {
    throw new PaymentProviderError(
      PaymentErrorCodes.ProviderUnavailable,
      `${displayName} در حال حاضر پاسخگو نیست`,
      String(status),
      true,
      raw,
    );
  }
  throw new PaymentProviderError(
    PaymentErrorCodes.ProviderRejected,
    `${displayName} درخواست ${operation} را رد کرد`,
    String(status),
    false,
    raw,
  );
}

export interface OAuthPasswordGrant {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  /** Extra headers sent with the token call (e.g. DigiPay's Agent / Digipay-Version). */
  headers?: Record<string, string>;
}

interface TokenResponse {
  access_token?: unknown;
  token_type?: unknown;
  expires_in?: unknown;
  error?: unknown;
  error_description?: unknown;
}

/** Safety margin subtracted from `expires_in` before a memoized token is reused. */
const TOKEN_EXPIRY_MARGIN_MS = 30_000;
/** OAuth2 error codes that mean the merchant credentials themselves are wrong. */
const CREDENTIAL_ERRORS = new Set(['invalid_grant', 'invalid_client', 'unauthorized_client']);

/**
 * Obtains a bearer token with the OAuth2 password grant (client id/secret as
 * HTTP Basic) and memoizes it for the adapter instance lifetime. A 401 from
 * an authorized call refreshes the token once and retries once.
 */
export class OAuthBearerSession {
  private token: string | null = null;
  private expiresAt = 0;

  constructor(
    private readonly http: ProviderHttpClient,
    private readonly displayName: string,
    private readonly grant: () => OAuthPasswordGrant,
  ) {}

  async accessToken(force = false): Promise<string> {
    if (!force && this.token && Date.now() < this.expiresAt) return this.token;
    const grant = this.grant();
    const basic = Buffer.from(`${grant.clientId}:${grant.clientSecret}`).toString('base64');
    const secrets = [grant.clientSecret, grant.password];
    const response = await this.http.postForm<TokenResponse>(
      grant.tokenUrl,
      // UNVERIFIED: confirm grant type and field names against contract documentation.
      { grant_type: 'password', username: grant.username, password: grant.password },
      { operation: 'token', headers: { Authorization: `Basic ${basic}`, ...grant.headers } },
    );
    const body = asRecord(response.data) as TokenResponse;
    const oauthError = typeof body.error === 'string' ? body.error : null;
    const raw = redactSensitive({ status: response.status, ...body }, secrets);
    if (
      response.status === 401 ||
      response.status === 403 ||
      (response.status === 400 && oauthError !== null && CREDENTIAL_ERRORS.has(oauthError))
    ) {
      this.token = null;
      throw new PaymentProviderError(
        PaymentErrorCodes.InvalidCredentials,
        `${this.displayName} اطلاعات ورود پذیرنده را نپذیرفت`,
        oauthError ?? String(response.status),
        false,
        raw,
      );
    }
    if (!isSuccessStatus(response.status))
      throwForHttpStatus(response.status, 'token', this.displayName, raw);
    if (typeof body.access_token !== 'string' || body.access_token.length === 0) {
      throw new PaymentProviderError(
        PaymentErrorCodes.InvalidResponse,
        `پاسخ توکن ${this.displayName} فاقد access_token است`,
        null,
        false,
        raw,
      );
    }
    this.token = body.access_token;
    const expiresIn = typeof body.expires_in === 'number' ? body.expires_in : 0;
    this.expiresAt =
      expiresIn > 0
        ? Date.now() + expiresIn * 1000 - TOKEN_EXPIRY_MARGIN_MS
        : Number.MAX_SAFE_INTEGER;
    return this.token;
  }

  /**
   * Runs `call` with a bearer Authorization header. On HTTP 401 the token is
   * refreshed once and the call retried once; a second 401 means the
   * credentials are not accepted for this operation.
   */
  async authorized<T>(
    operation: string,
    call: (headers: Record<string, string>) => Promise<HttpJsonResponse<T>>,
  ): Promise<HttpJsonResponse<T>> {
    let response = await call({ Authorization: `Bearer ${await this.accessToken()}` });
    if (response.status === 401) {
      response = await call({ Authorization: `Bearer ${await this.accessToken(true)}` });
      if (response.status === 401) {
        throw new PaymentProviderError(
          PaymentErrorCodes.InvalidCredentials,
          `${this.displayName} توکن دسترسی را برای ${operation} نپذیرفت`,
          '401',
          false,
          redactSensitive(response.data),
        );
      }
    }
    return response;
  }
}
