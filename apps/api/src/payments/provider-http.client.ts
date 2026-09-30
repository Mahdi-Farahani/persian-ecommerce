import { Logger } from '@nestjs/common';
import type { PaymentProviderName } from '@pe/shared';
import { PaymentErrorCodes, PaymentProviderError } from './payment.errors.js';

export interface HttpJsonResponse<T = unknown> {
  status: number;
  data: T;
  headers: Headers;
}

export interface HttpRequestOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Name used in structured logs (never the URL query or body). */
  operation: string;
}

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Minimal JSON HTTP client for provider adapters. Logs
 * {provider, operation, host, status, durationMs} and never request/response
 * bodies or headers (which may contain credentials).
 */
export class ProviderHttpClient {
  private readonly logger: Logger;

  constructor(
    private readonly provider: PaymentProviderName,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.logger = new Logger(`Payments:${provider}`);
  }

  postJson<T = unknown>(
    url: string,
    body: unknown,
    options: HttpRequestOptions,
  ): Promise<HttpJsonResponse<T>> {
    return this.request<T>('POST', url, JSON.stringify(body), {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  }

  postForm<T = unknown>(
    url: string,
    form: Record<string, string>,
    options: HttpRequestOptions,
  ): Promise<HttpJsonResponse<T>> {
    return this.request<T>('POST', url, new URLSearchParams(form).toString(), {
      ...options,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...options.headers },
    });
  }

  getJson<T = unknown>(url: string, options: HttpRequestOptions): Promise<HttpJsonResponse<T>> {
    return this.request<T>('GET', url, undefined, options);
  }

  private async request<T>(
    method: 'GET' | 'POST',
    url: string,
    body: string | undefined,
    options: HttpRequestOptions,
  ): Promise<HttpJsonResponse<T>> {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const host = safeHost(url);
    try {
      const response = await this.fetchImpl(url, {
        method,
        body,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'persian-ecommerce/1.0',
          ...options.headers,
        },
        signal: controller.signal,
        redirect: 'manual',
      });
      const text = await response.text();
      let data: unknown = null;
      if (text.length > 0) {
        try {
          data = JSON.parse(text);
        } catch {
          throw new PaymentProviderError(
            PaymentErrorCodes.InvalidResponse,
            'پاسخ درگاه پرداخت قابل خواندن نیست',
            String(response.status),
            false,
            { status: response.status, bodyPreview: text.slice(0, 200) },
          );
        }
      }
      this.logger.log({
        message: 'provider call',
        provider: this.provider,
        operation: options.operation,
        host,
        status: response.status,
        durationMs: Date.now() - started,
      });
      return { status: response.status, data: data as T, headers: response.headers };
    } catch (error) {
      if (error instanceof PaymentProviderError) throw error;
      const aborted = (error as Error).name === 'AbortError';
      this.logger.warn({
        message: 'provider call failed',
        provider: this.provider,
        operation: options.operation,
        host,
        durationMs: Date.now() - started,
        error: aborted ? 'timeout' : (error as Error).message,
      });
      throw new PaymentProviderError(
        aborted ? PaymentErrorCodes.Timeout : PaymentErrorCodes.NetworkError,
        aborted ? 'درگاه پرداخت در زمان مقرر پاسخ نداد' : 'ارتباط با درگاه پرداخت برقرار نشد',
        null,
        true,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'invalid-url';
  }
}
