import type { PaymentProviderName } from '@pe/shared';
import type {
  CallbackPayload,
  CreatePaymentRequest,
  ParsedCallback,
  PaymentProvider,
  ProviderContext,
  ProviderDefinition,
  VerifyPaymentRequest,
} from '../payment-provider.types.js';
import { PaymentErrorCodes, PaymentProviderError } from '../payment.errors.js';
import { ProviderHttpClient } from '../provider-http.client.js';

/**
 * Behavioural contract every payment adapter must satisfy, run from each
 * adapter's spec with provider-specific fixtures. Providers talk to a stubbed
 * `fetch`; the suite never touches the network.
 */

export type FetchHandler = (url: string, init: RequestInit) => Response | Promise<Response>;

export interface RecordedCall {
  url: string;
  init: RequestInit;
}

export interface ContractScenarios {
  /** Token (when any) and create calls succeed. */
  createSuccess: FetchHandler;
  /** Credentials are rejected (401 on the token call or on the request). */
  invalidCredentials: FetchHandler;
  /** The provider declines the create request with a business error. */
  providerError: FetchHandler;
  verifySuccess: FetchHandler;
  verifyFailed: FetchHandler;
  /** Fresh stateful handler: the first verify succeeds, later ones report a duplicate. */
  verifyDuplicate: () => FetchHandler;
  /** Verify for an authority the provider does not know. */
  verifyUnknownAuthority: FetchHandler;
}

export interface ContractFixtures {
  /** IRR amount used for every request in the suite. */
  amount: number;
  /** Authority the create scenario returns / the verify scenarios accept. */
  authority: string;
  unknownAuthority: string;
  callbacks: {
    ok: CallbackPayload;
    failed: CallbackPayload;
    garbage: CallbackPayload;
    /** A callback that echoes the amount, with the IRR value parseCallback must report. */
    echoedAmount: { payload: CallbackPayload; expectedIrr: number } | null;
  };
  /** Null for adapters that make no HTTP calls (mock gateway). */
  scenarios: ContractScenarios | null;
  /** Credential values that must never appear in results or errors. */
  secrets: string[];
}

export interface ProviderContractHarness {
  provider: PaymentProvider;
  respond(handler: FetchHandler): void;
  fixtures: ContractFixtures;
}

// --- stub helpers -----------------------------------------------------------------

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === undefined ? '' : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function stubHttp(provider: PaymentProviderName): {
  http: ProviderHttpClient;
  calls: RecordedCall[];
  respond(handler: FetchHandler): void;
} {
  let handler: FetchHandler = () => jsonResponse({ message: 'no handler installed' }, 404);
  const calls: RecordedCall[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init: init ?? {} });
    return handler(url, init ?? {});
  };
  return {
    http: new ProviderHttpClient(provider, fetchImpl),
    calls,
    respond: (next) => {
      handler = next;
    },
  };
}

export function headerOf(init: RequestInit, name: string): string | null {
  return new Headers(init.headers).get(name);
}

/** ProviderHttpClient always sends string bodies. */
function stringBodyOf(init: RequestInit): string {
  return typeof init.body === 'string' ? init.body : '';
}

export function jsonBodyOf(init: RequestInit): Record<string, unknown> {
  return JSON.parse(stringBodyOf(init) || '{}') as Record<string, unknown>;
}

export function formBodyOf(init: RequestInit): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(stringBodyOf(init)));
}

export function pathOf(url: string): string {
  return new URL(url).pathname;
}

/** Context seeded with the definition's default settings (as the registry does). */
export function contextFor(
  definition: ProviderDefinition,
  overrides: Partial<ProviderContext> = {},
): ProviderContext {
  const settings: Record<string, string> = {};
  for (const field of definition.settingFields) {
    if (field.defaultValue !== undefined) settings[field.key] = field.defaultValue;
  }
  return {
    provider: definition.provider,
    environment: 'SANDBOX',
    credentials: {},
    callbackUrl: 'https://api.example.test/payments/callback',
    ...overrides,
    settings: { ...settings, ...overrides.settings },
  };
}

export function createRequest(
  amount: number,
  overrides: Partial<CreatePaymentRequest> = {},
): CreatePaymentRequest {
  return {
    paymentId: 'pay_1',
    requestId: 'req_1',
    orderId: 'ord_1',
    orderNumber: 'PE-1001',
    amount,
    currency: 'IRR',
    description: 'پرداخت سفارش PE-1001',
    customer: { mobile: '09123456789', email: 'buyer@example.test', name: 'خریدار' },
    callbackUrl: 'https://api.example.test/payments/callback?paymentId=pay_1',
    items: [{ title: 'کالای نمونه', quantity: 2, unitPrice: amount / 2 }],
    ...overrides,
  };
}

export function verifyRequest(
  authority: string,
  amount: number,
  callback: ParsedCallback | null,
  overrides: Partial<VerifyPaymentRequest> = {},
): VerifyPaymentRequest {
  return {
    paymentId: 'pay_1',
    requestId: 'req_1',
    authority,
    amount,
    currency: 'IRR',
    callback,
    ...overrides,
  };
}

function expectNoSecrets(value: unknown, secrets: string[]): void {
  const text = JSON.stringify(value) ?? '';
  for (const secret of secrets) expect(text).not.toContain(secret);
}

// --- the suite ---------------------------------------------------------------------

export function runProviderContractSuite(
  name: string,
  factory: () => ProviderContractHarness,
): void {
  describe(`${name} provider contract`, () => {
    let harness: ProviderContractHarness;
    beforeEach(() => {
      harness = factory();
    });

    const fixtures = () => harness.fixtures;
    const scenarios = () => harness.fixtures.scenarios;
    const verify = (authority: string, callback: ParsedCallback | null) =>
      harness.provider.verifyPayment(verifyRequest(authority, fixtures().amount, callback));

    it('creates a payment and returns an authority plus redirect', async () => {
      if (scenarios()) harness.respond(scenarios()!.createSuccess);
      const result = await harness.provider.createPayment(createRequest(fixtures().amount));
      expect(result.authority).toEqual(expect.any(String));
      expect(result.authority.length).toBeGreaterThan(0);
      expect(result.redirectUrl).toMatch(/^https?:\/\//);
      expect(['GET', 'POST']).toContain(result.redirectMethod);
      expectNoSecrets(result.raw, fixtures().secrets);
    });

    it('rejects invalid credentials with a normalized error', async () => {
      if (!scenarios()) return;
      harness.respond(scenarios()!.invalidCredentials);
      const failure = await harness.provider.createPayment(createRequest(fixtures().amount)).then(
        () => null,
        (error: unknown) => error,
      );
      expect(failure).toBeInstanceOf(PaymentProviderError);
      const error = failure as PaymentProviderError;
      expect([PaymentErrorCodes.InvalidCredentials, PaymentErrorCodes.ProviderRejected]).toContain(
        error.code,
      );
      expectNoSecrets({ message: error.message, raw: error.raw }, fixtures().secrets);
    });

    it('surfaces a provider error response as PaymentProviderError', async () => {
      if (!scenarios()) return;
      harness.respond(scenarios()!.providerError);
      const failure = await harness.provider.createPayment(createRequest(fixtures().amount)).then(
        () => null,
        (error: unknown) => error,
      );
      expect(failure).toBeInstanceOf(PaymentProviderError);
      const error = failure as PaymentProviderError;
      expect([PaymentErrorCodes.NetworkError, PaymentErrorCodes.Timeout]).not.toContain(error.code);
      expectNoSecrets({ message: error.message, raw: error.raw }, fixtures().secrets);
    });

    it('parses a successful callback', () => {
      const parsed = harness.provider.parseCallback(fixtures().callbacks.ok);
      expect(parsed.outcome).toBe('OK');
      expect([parsed.authority, parsed.reference, parsed.providerTransactionId].some(Boolean)).toBe(
        true,
      );
      expectNoSecrets(parsed.raw, fixtures().secrets);
    });

    it('parses a failed or cancelled callback', () => {
      const parsed = harness.provider.parseCallback(fixtures().callbacks.failed);
      expect(['FAILED', 'CANCELLED']).toContain(parsed.outcome);
    });

    it('never throws on garbage callbacks', () => {
      const garbage = harness.provider.parseCallback(fixtures().callbacks.garbage);
      expect(garbage.outcome).toBe('UNKNOWN');
      expect(garbage.authority).toBeNull();
      for (const payload of [
        { method: 'GET', query: {}, body: {} },
        { method: 'POST', query: {}, body: {} },
        { method: 'POST', query: { a: [1, 2] }, body: { status: 42, authority: { x: 1 } } },
        { method: 'GET', query: { amount: 'abc', Status: null }, body: {} },
      ] satisfies CallbackPayload[]) {
        expect(() => harness.provider.parseCallback(payload)).not.toThrow();
      }
    });

    it('parses the same callback deterministically (duplicate callback)', () => {
      const first = harness.provider.parseCallback(fixtures().callbacks.ok);
      const second = harness.provider.parseCallback(fixtures().callbacks.ok);
      expect(second).toEqual(first);
    });

    it('verifies a successful payment', async () => {
      if (scenarios()) harness.respond(scenarios()!.verifySuccess);
      const result = await verify(
        fixtures().authority,
        harness.provider.parseCallback(fixtures().callbacks.ok),
      );
      expect(result.status).toBe('PAID');
      if (result.status !== 'PAID') return;
      expect(result.providerTransactionId).toEqual(expect.any(String));
      expect(result.providerTransactionId.length).toBeGreaterThan(0);
      expect(result.alreadyVerified).toBe(false);
      expect(result.cardPanMask === null || typeof result.cardPanMask === 'string').toBe(true);
      expect(result.amount === null || result.amount === fixtures().amount).toBe(true);
      expectNoSecrets(result.raw, fixtures().secrets);
    });

    it('reports a declined verification as FAILED without throwing', async () => {
      if (scenarios()) harness.respond(scenarios()!.verifyFailed);
      const result = await verify(
        fixtures().authority,
        harness.provider.parseCallback(fixtures().callbacks.failed),
      );
      expect(result.status).toBe('FAILED');
      if (result.status !== 'FAILED') return;
      expect(result.errorCode.length).toBeGreaterThan(0);
      expect(result.errorMessage.length).toBeGreaterThan(0);
      expectNoSecrets(result.raw, fixtures().secrets);
    });

    it('does not throw on duplicate verification', async () => {
      if (scenarios()) harness.respond(scenarios()!.verifyDuplicate());
      const callback = harness.provider.parseCallback(fixtures().callbacks.ok);
      const first = await verify(fixtures().authority, callback);
      expect(first.status).toBe('PAID');
      const second = await verify(fixtures().authority, callback);
      expect(['PAID', 'FAILED']).toContain(second.status);
      if (second.status === 'PAID' && scenarios()) expect(second.alreadyVerified).toBe(true);
      if (second.status === 'FAILED') {
        expect(`${second.errorCode} ${second.errorMessage}`).toMatch(/already|101|duplicate/i);
      }
    });

    it('exposes the echoed callback amount in IRR', () => {
      const echoed = fixtures().callbacks.echoedAmount;
      if (!echoed) return;
      const parsed = harness.provider.parseCallback(echoed.payload);
      expect(parsed.amount).toBe(echoed.expectedIrr);
    });

    it('never reports PAID for an unknown authority (transaction mismatch)', async () => {
      if (scenarios()) harness.respond(scenarios()!.verifyUnknownAuthority);
      const outcome = await verify(fixtures().unknownAuthority, null).then(
        (result) => result,
        (error: unknown) => error,
      );
      if (outcome instanceof PaymentProviderError) {
        expect(outcome.code).not.toBe(PaymentErrorCodes.NetworkError);
        return;
      }
      expect((outcome as { status: string }).status).not.toBe('PAID');
    });

    it('maps network failures to a retryable PaymentProviderError', async () => {
      if (!scenarios()) return;
      harness.respond(() => Promise.reject(new TypeError('fetch failed')));
      const failure = await harness.provider.createPayment(createRequest(fixtures().amount)).then(
        () => null,
        (error: unknown) => error,
      );
      expect(failure).toBeInstanceOf(PaymentProviderError);
      const error = failure as PaymentProviderError;
      expect([PaymentErrorCodes.NetworkError, PaymentErrorCodes.Timeout]).toContain(error.code);
      expect(error.retryable).toBe(true);
      expectNoSecrets({ message: error.message, raw: error.raw }, fixtures().secrets);
    });
  });
}
