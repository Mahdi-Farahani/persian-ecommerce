import { PaymentErrorCodes, PaymentProviderError } from '../payment.errors.js';
import {
  contextFor,
  createRequest,
  formBodyOf,
  headerOf,
  jsonBodyOf,
  jsonResponse,
  pathOf,
  runProviderContractSuite,
  stubHttp,
  verifyRequest,
  type FetchHandler,
  type RecordedCall,
} from './provider-contract.suite.js';
import {
  TOROB_PAY_DEFINITION,
  TOROB_PAY_PRODUCTION_BASE_URL,
  TorobPayPaymentProvider,
} from './torob-pay.provider.js';

/**
 * No TorobPay endpoint path is published, so the spec configures paths
 * explicitly. All response shapes are UNVERIFIED assumptions of the adapter
 * (docs/payments/TOROB-PAY.md).
 */
const PATHS = {
  tokenPath: 'api/v1/oauth/token',
  paymentTokenPath: 'api/v1/payment/token',
  verifyPath: 'api/v1/payment/verify',
  settlePath: 'api/v1/payment/settle',
  revertPath: 'api/v1/payment/revert',
  statusPath: 'api/v1/payment/status',
};
const CREDENTIALS = {
  merchantId: 'torob-merchant-id-XYZ',
  merchantKey: 'torob-merchant-key-SECRET',
  username: 'torob-user-USR',
  password: 'torob-pass-PWD',
};
const SECRETS = Object.values(CREDENTIALS);
const AMOUNT = 3_000_000;
const PAYMENT_TOKEN = 'TPT-1';
const PAGE_URL = 'https://cpg.torobpay.com/pay/TPT-1';

const tokenOk = () =>
  jsonResponse({ access_token: 'tok-1', token_type: 'bearer', expires_in: 3600 });
const createOk = () =>
  jsonResponse({
    successful: true,
    response: { paymentToken: PAYMENT_TOKEN, paymentPageUrl: PAGE_URL },
  });
const verifyOk = () =>
  jsonResponse({ successful: true, response: { transactionId: 'TTX-1', amount: AMOUNT } });
const declined = (errorCode: string, message: string, status = 200) =>
  jsonResponse({ successful: false, errorData: { errorCode, message } }, status);

type Route = keyof typeof PATHS;

function router(routes: Partial<Record<Route, FetchHandler>>): FetchHandler {
  const defaults: Record<Route, FetchHandler> = {
    tokenPath: tokenOk,
    paymentTokenPath: createOk,
    verifyPath: verifyOk,
    settlePath: () => jsonResponse({ successful: true, response: {} }),
    revertPath: () => jsonResponse({ successful: true, response: {} }),
    statusPath: () =>
      jsonResponse({ successful: true, response: { status: 'PAID', transactionId: 'TTX-1' } }),
  };
  return (url, init) => {
    const path = pathOf(url);
    for (const route of Object.keys(PATHS) as Route[]) {
      if (path.endsWith(`/${PATHS[route]}`)) return (routes[route] ?? defaults[route])(url, init);
    }
    return jsonResponse({ message: 'unexpected path' }, 404);
  };
}

function harness(overrides: Parameters<typeof contextFor>[1] = {}) {
  const stub = stubHttp('TOROB_PAY');
  const context = contextFor(TOROB_PAY_DEFINITION, {
    environment: 'PRODUCTION',
    credentials: CREDENTIALS,
    ...overrides,
    settings: { ...PATHS, contractDocsConfirmed: 'yes', ...overrides.settings },
  });
  return { ...stub, provider: new TorobPayPaymentProvider(context, stub.http) };
}

const okCallback = {
  method: 'POST' as const,
  query: {},
  body: { paymentToken: PAYMENT_TOKEN, transactionId: 'pay_1', status: 'SUCCESS' },
};

runProviderContractSuite('TorobPay', () => {
  const { provider, respond } = harness();
  return {
    provider,
    respond,
    fixtures: {
      amount: AMOUNT,
      authority: PAYMENT_TOKEN,
      unknownAuthority: 'TPT-unknown',
      callbacks: {
        ok: okCallback,
        failed: { ...okCallback, body: { ...okCallback.body, status: 'CANCELLED' } },
        garbage: { method: 'GET', query: { foo: 'bar' }, body: {} },
        echoedAmount: {
          payload: { ...okCallback, body: { ...okCallback.body, amount: AMOUNT } },
          expectedIrr: AMOUNT,
        },
      },
      scenarios: {
        createSuccess: router({}),
        invalidCredentials: router({
          tokenPath: () => jsonResponse({ error: 'invalid_grant' }, 400),
        }),
        providerError: router({
          paymentTokenPath: () => declined('E100', 'مبلغ خارج از محدوده', 422),
        }),
        verifySuccess: router({}),
        verifyFailed: router({ verifyPath: () => declined('E200', 'پرداخت انجام نشد') }),
        verifyDuplicate: () => {
          let verifies = 0;
          return router({
            verifyPath: () =>
              verifies++ === 0 ? verifyOk() : declined('DUPLICATE_VERIFY', 'already verified'),
          });
        },
        verifyUnknownAuthority: router({ verifyPath: () => declined('E404', 'not found', 404) }),
      },
      secrets: SECRETS,
    },
  };
});

describe('TorobPayPaymentProvider', () => {
  const callsTo = (calls: RecordedCall[], route: Route) =>
    calls.filter((c) => pathOf(c.url).endsWith(`/${PATHS[route]}`));

  it('uses merchantId/merchantKey as the OAuth client and the published production host', async () => {
    const { provider, respond, calls } = harness();
    respond(router({}));
    await provider.createPayment(createRequest(AMOUNT));
    const [token] = callsTo(calls, 'tokenPath');
    expect(token!.url).toBe(`${TOROB_PAY_PRODUCTION_BASE_URL}/${PATHS.tokenPath}`);
    expect(headerOf(token!.init, 'authorization')).toBe(
      `Basic ${Buffer.from(`${CREDENTIALS.merchantId}:${CREDENTIALS.merchantKey}`).toString('base64')}`,
    );
    expect(formBodyOf(token!.init)).toEqual({
      grant_type: 'password',
      username: CREDENTIALS.username,
      password: CREDENTIALS.password,
    });
  });

  it('creates a payment with the bearer header, currency and items in toman', async () => {
    const { provider, respond, calls } = harness({ settings: { amountUnit: 'IRT' } });
    respond(router({}));
    const result = await provider.createPayment(createRequest(AMOUNT));
    const [create] = callsTo(calls, 'paymentTokenPath');
    expect(headerOf(create!.init, 'authorization')).toBe('Bearer tok-1');
    expect(jsonBodyOf(create!.init)).toMatchObject({
      amount: AMOUNT / 10,
      currency: 'IRT',
      mobile: '09123456789',
      returnURL: 'https://api.example.test/payments/callback?paymentId=pay_1',
      transactionId: 'pay_1',
      orderId: 'PE-1001',
      items: [{ name: 'کالای نمونه', count: 2, amount: AMOUNT / 2 / 10 }],
    });
    expect(result).toMatchObject({ authority: PAYMENT_TOKEN, redirectUrl: PAGE_URL });
  });

  it('throws Misconfigured naming the missing path setting', async () => {
    const { provider, respond } = harness({ settings: { paymentTokenPath: '' } });
    respond(router({}));
    const failure = await provider.createPayment(createRequest(AMOUNT)).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(PaymentProviderError);
    expect((failure as PaymentProviderError).code).toBe(PaymentErrorCodes.Misconfigured);
    expect((failure as PaymentProviderError).message).toContain('payment token');
  });

  it('has no default paths and no sandbox URL because none were published', () => {
    for (const key of Object.keys(PATHS)) {
      expect(TOROB_PAY_DEFINITION.settingFields.find((f) => f.key === key)?.defaultValue).toBe('');
    }
    expect(
      TOROB_PAY_DEFINITION.settingFields.find((f) => f.key === 'sandboxBaseUrl')?.defaultValue,
    ).toBe('');
    expect(TOROB_PAY_DEFINITION.supportsSandbox).toBe(false);
    expect(TOROB_PAY_DEFINITION.docsStatus).toBe('UNVERIFIED');
    expect(TOROB_PAY_DEFINITION.capabilities).toEqual([
      'create',
      'verify',
      'settle',
      'refund',
      'inquiry',
    ]);
  });

  it('refreshes the token once and retries once on 401', async () => {
    const { provider, respond, calls } = harness();
    let tokens = 0;
    respond(
      router({
        tokenPath: () => jsonResponse({ access_token: `tok-${++tokens}` }),
        verifyPath: (_url, init) =>
          headerOf(init, 'authorization') === 'Bearer tok-2'
            ? verifyOk()
            : jsonResponse({ error: 'expired' }, 401),
      }),
    );
    const result = await provider.verifyPayment(verifyRequest(PAYMENT_TOKEN, AMOUNT, null));
    expect(result.status).toBe('PAID');
    expect(callsTo(calls, 'tokenPath')).toHaveLength(2);
    expect(callsTo(calls, 'verifyPath')).toHaveLength(2);
  });

  it('maps a 401 on the token call to INVALID_CREDENTIALS', async () => {
    const { provider, respond } = harness();
    respond(router({ tokenPath: () => jsonResponse({ error: 'unauthorized' }, 401) }));
    await expect(provider.testConnection()).rejects.toMatchObject({
      code: PaymentErrorCodes.InvalidCredentials,
    });
  });

  it('blocks createPayment until the contract documentation is confirmed', async () => {
    const { provider, respond, calls } = harness({ settings: { contractDocsConfirmed: 'no' } });
    respond(router({}));
    await expect(provider.createPayment(createRequest(AMOUNT))).rejects.toMatchObject({
      code: PaymentErrorCodes.Misconfigured,
    });
    expect(calls).toHaveLength(0);
    const test = await provider.testConnection();
    expect(test.ok).toBe(true);
    expect(test.message).toContain('مستندات قرارداد');
  });

  it('never leaks credentials into errors, even when echoed by the provider', async () => {
    const { provider, respond } = harness();
    respond(
      router({
        tokenPath: () =>
          jsonResponse(
            {
              error: 'invalid_grant',
              error_description: `wrong ${CREDENTIALS.password}`,
              merchantKey: CREDENTIALS.merchantKey,
              refresh_token: 'leak',
            },
            400,
          ),
      }),
    );
    const failure = await provider.createPayment(createRequest(AMOUNT)).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(PaymentProviderError);
    const error = failure as PaymentProviderError;
    expect(error.code).toBe(PaymentErrorCodes.InvalidCredentials);
    const text = `${error.message} ${JSON.stringify(error.raw)}`;
    for (const secret of [...SECRETS, 'leak']) expect(text).not.toContain(secret);
  });

  it('maps status words from the inquiry endpoint', async () => {
    const { provider, respond, calls } = harness();
    respond(router({}));
    const paid = await provider.inquirePayment({
      paymentId: 'pay_1',
      authority: PAYMENT_TOKEN,
      amount: AMOUNT,
    });
    expect(paid).toMatchObject({ status: 'PAID', providerTransactionId: 'TTX-1' });
    expect(jsonBodyOf(callsTo(calls, 'statusPath')[0]!.init)).toEqual({
      paymentToken: PAYMENT_TOKEN,
    });

    respond(
      router({
        statusPath: () => jsonResponse({ successful: true, response: { status: 'EXPIRED' } }),
      }),
    );
    const failed = await provider.inquirePayment({
      paymentId: 'pay_1',
      authority: PAYMENT_TOKEN,
      amount: AMOUNT,
    });
    expect(failed).toMatchObject({ status: 'FAILED', errorCode: 'EXPIRED' });

    respond(
      router({
        statusPath: () => jsonResponse({ successful: true, response: { status: 'PENDING' } }),
      }),
    );
    expect(
      (
        await provider.inquirePayment({
          paymentId: 'pay_1',
          authority: PAYMENT_TOKEN,
          amount: AMOUNT,
        })
      ).status,
    ).toBe('PENDING');

    respond(router({ statusPath: () => declined('E1', 'oops') }));
    expect(
      (
        await provider.inquirePayment({
          paymentId: 'pay_1',
          authority: PAYMENT_TOKEN,
          amount: AMOUNT,
        })
      ).status,
    ).toBe('UNKNOWN');
  });

  it('returns FAILED for a verify response whose status word is a failure', async () => {
    const { provider, respond } = harness();
    respond(
      router({
        verifyPath: () => jsonResponse({ successful: true, response: { status: 'REVERTED' } }),
      }),
    );
    const result = await provider.verifyPayment(verifyRequest(PAYMENT_TOKEN, AMOUNT, null));
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'REVERTED' });
  });

  it('throws a retryable ProviderUnavailable on 5xx', async () => {
    const { provider, respond } = harness();
    respond(router({ paymentTokenPath: () => jsonResponse({ message: 'down' }, 502) }));
    await expect(provider.createPayment(createRequest(AMOUNT))).rejects.toMatchObject({
      code: PaymentErrorCodes.ProviderUnavailable,
      retryable: true,
    });
  });
});
