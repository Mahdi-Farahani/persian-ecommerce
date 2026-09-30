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
import { SNAPP_PAY_DEFINITION, SnappPayPaymentProvider } from './snapp-pay.provider.js';

/** Every response shape here is an UNVERIFIED assumption of the adapter (docs/payments/SNAPP-PAY.md). */
const BASE_URL = 'https://snapppay.example.test';
const CREDENTIALS = {
  clientId: 'snapp-client-id-XYZ',
  clientSecret: 'snapp-client-secret-SECRET',
  username: 'snapp-user-USR',
  password: 'snapp-pass-PWD',
};
const SECRETS = Object.values(CREDENTIALS);
const AMOUNT = 2_000_000;
const PAYMENT_TOKEN = 'PT-123';
const PAGE_URL = 'https://payment.snapppay.example.test/PT-123';

const tokenOk = () =>
  jsonResponse({ access_token: 'tok-1', token_type: 'bearer', expires_in: 3600 });
const createOk = () =>
  jsonResponse({
    successful: true,
    response: { paymentToken: PAYMENT_TOKEN, paymentPageUrl: PAGE_URL },
  });
const verifyOk = () =>
  jsonResponse({ successful: true, response: { transactionId: 'TX-1', amount: AMOUNT } });
const declined = (errorCode: string, message: string, status = 200) =>
  jsonResponse({ successful: false, errorData: { errorCode, message } }, status);

type Route = 'token' | 'create' | 'verify' | 'settle' | 'revert';

function router(routes: Partial<Record<Route, FetchHandler>>): FetchHandler {
  return (url, init) => {
    const path = pathOf(url);
    if (path.endsWith('/oauth/token')) return (routes.token ?? tokenOk)(url, init);
    if (path.endsWith('/payment/v1/token')) return (routes.create ?? createOk)(url, init);
    if (path.endsWith('/payment/v1/verify')) return (routes.verify ?? verifyOk)(url, init);
    if (path.endsWith('/payment/v1/settle')) {
      return (routes.settle ?? (() => jsonResponse({ successful: true, response: {} })))(url, init);
    }
    if (path.endsWith('/payment/v1/revert')) {
      return (routes.revert ?? (() => jsonResponse({ successful: true, response: {} })))(url, init);
    }
    return jsonResponse({ message: 'unexpected path' }, 404);
  };
}

function harness(overrides: Parameters<typeof contextFor>[1] = {}) {
  const stub = stubHttp('SNAPP_PAY');
  const context = contextFor(SNAPP_PAY_DEFINITION, {
    environment: 'PRODUCTION',
    credentials: CREDENTIALS,
    ...overrides,
    settings: { productionBaseUrl: BASE_URL, contractDocsConfirmed: 'yes', ...overrides.settings },
  });
  return { ...stub, provider: new SnappPayPaymentProvider(context, stub.http) };
}

const okCallback = {
  method: 'GET' as const,
  query: { paymentToken: PAYMENT_TOKEN, transactionId: 'pay_1', state: 'OK' },
  body: {},
};

runProviderContractSuite('SnappPay', () => {
  const { provider, respond } = harness();
  return {
    provider,
    respond,
    fixtures: {
      amount: AMOUNT,
      authority: PAYMENT_TOKEN,
      unknownAuthority: 'PT-unknown',
      callbacks: {
        ok: okCallback,
        failed: { ...okCallback, query: { ...okCallback.query, state: 'FAILED' } },
        garbage: { method: 'GET', query: { foo: 'bar' }, body: {} },
        echoedAmount: {
          payload: { ...okCallback, query: { ...okCallback.query, amount: String(AMOUNT) } },
          expectedIrr: AMOUNT,
        },
      },
      scenarios: {
        createSuccess: router({}),
        invalidCredentials: router({ token: () => jsonResponse({ error: 'invalid_client' }, 401) }),
        providerError: router({ create: () => declined('1001', 'کاربر واجد شرایط نیست', 400) }),
        verifySuccess: router({}),
        verifyFailed: router({ verify: () => declined('2001', 'پرداخت ناموفق') }),
        verifyDuplicate: () => {
          let verifies = 0;
          return router({
            verify: () =>
              verifies++ === 0 ? verifyOk() : declined('ALREADY_VERIFIED', 'already verified'),
          });
        },
        verifyUnknownAuthority: router({
          verify: () => declined('NOT_FOUND', 'token not found', 404),
        }),
      },
      secrets: SECRETS,
    },
  };
});

describe('SnappPayPaymentProvider', () => {
  const callsTo = (calls: RecordedCall[], suffix: string) =>
    calls.filter((c) => pathOf(c.url).endsWith(suffix));

  it('obtains a token with Basic client auth and the password grant', async () => {
    const { provider, respond, calls } = harness();
    respond(router({}));
    await provider.createPayment(createRequest(AMOUNT));
    const [token] = callsTo(calls, '/oauth/token');
    expect(token!.url).toBe(`${BASE_URL}/api/online/v1/oauth/token`);
    expect(headerOf(token!.init, 'authorization')).toBe(
      `Basic ${Buffer.from(`${CREDENTIALS.clientId}:${CREDENTIALS.clientSecret}`).toString('base64')}`,
    );
    expect(formBodyOf(token!.init)).toEqual({
      grant_type: 'password',
      username: CREDENTIALS.username,
      password: CREDENTIALS.password,
    });
  });

  it('creates a payment token with the bearer header, cart and toman amounts', async () => {
    const { provider, respond, calls } = harness({ settings: { amountUnit: 'IRT' } });
    respond(router({}));
    const result = await provider.createPayment(createRequest(AMOUNT));
    const [create] = callsTo(calls, '/payment/v1/token');
    expect(create!.url).toBe(`${BASE_URL}/api/online/payment/v1/token`);
    expect(headerOf(create!.init, 'authorization')).toBe('Bearer tok-1');
    expect(headerOf(create!.init, 'content-type')).toBe('application/json');
    expect(jsonBodyOf(create!.init)).toMatchObject({
      amount: AMOUNT / 10,
      mobile: '09123456789',
      returnURL: 'https://api.example.test/payments/callback?paymentId=pay_1',
      transactionId: 'pay_1',
      cartList: [
        {
          cartId: 'PE-1001',
          totalAmount: AMOUNT / 10,
          items: [{ name: 'کالای نمونه', count: 2, amount: AMOUNT / 2 / 10 }],
        },
      ],
    });
    expect(result).toMatchObject({
      authority: PAYMENT_TOKEN,
      redirectUrl: PAGE_URL,
      redirectMethod: 'GET',
    });
  });

  it('accepts an absolute URL as a path setting (token endpoint on another host)', async () => {
    const { provider, respond, calls } = harness({
      settings: { tokenPath: 'https://auth.snapppay.example.test/oauth/token' },
    });
    respond(router({}));
    await provider.createPayment(createRequest(AMOUNT));
    expect(callsTo(calls, '/oauth/token')[0]!.url).toBe(
      'https://auth.snapppay.example.test/oauth/token',
    );
  });

  it('refreshes the token once and retries once on 401', async () => {
    const { provider, respond, calls } = harness();
    let tokens = 0;
    respond(
      router({
        token: () => jsonResponse({ access_token: `tok-${++tokens}`, expires_in: 60 }),
        create: (_url, init) =>
          headerOf(init, 'authorization') === 'Bearer tok-2'
            ? createOk()
            : jsonResponse({ error: 'invalid_token' }, 401),
      }),
    );
    const result = await provider.createPayment(createRequest(AMOUNT));
    expect(result.authority).toBe(PAYMENT_TOKEN);
    expect(callsTo(calls, '/oauth/token')).toHaveLength(2);
    expect(callsTo(calls, '/payment/v1/token')).toHaveLength(2);
  });

  it('reports INVALID_CREDENTIALS when the retried call is still 401', async () => {
    const { provider, respond } = harness();
    respond(router({ create: () => jsonResponse({ error: 'invalid_token' }, 401) }));
    await expect(provider.createPayment(createRequest(AMOUNT))).rejects.toMatchObject({
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
    expect(callsTo(calls, '/oauth/token')).toHaveLength(1);
  });

  it('throws Misconfigured when no base URL is configured (none is published)', async () => {
    const { provider } = harness({ settings: { productionBaseUrl: '' } });
    await expect(provider.createPayment(createRequest(AMOUNT))).rejects.toMatchObject({
      code: PaymentErrorCodes.Misconfigured,
    });
    await expect(provider.testConnection()).rejects.toMatchObject({
      code: PaymentErrorCodes.Misconfigured,
    });
  });

  it('throws Misconfigured for a missing credential', async () => {
    const { provider, respond } = harness({ credentials: { ...CREDENTIALS, password: '' } });
    respond(router({}));
    await expect(provider.createPayment(createRequest(AMOUNT))).rejects.toMatchObject({
      code: PaymentErrorCodes.Misconfigured,
    });
  });

  it('never leaks credentials into errors, even when echoed by the provider', async () => {
    const { provider, respond } = harness();
    respond(
      router({
        create: () =>
          jsonResponse(
            {
              successful: false,
              errorData: {
                errorCode: '500',
                message: `rejected for ${CREDENTIALS.username}/${CREDENTIALS.password}`,
              },
              debug: { client_secret: CREDENTIALS.clientSecret, access_token: 'tok-1' },
            },
            400,
          ),
      }),
    );
    const failure = await provider.createPayment(createRequest(AMOUNT)).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(PaymentProviderError);
    const error = failure as PaymentProviderError;
    expect(error.code).toBe(PaymentErrorCodes.ProviderRejected);
    const text = `${error.message} ${JSON.stringify(error.raw)}`;
    for (const secret of [...SECRETS, 'tok-1']) expect(text).not.toContain(secret);
  });

  it('parses callbacks with the payment token as authority and our id as reference', () => {
    const { provider } = harness({ settings: { amountUnit: 'IRT' } });
    const parsed = provider.parseCallback({
      method: 'POST',
      query: { state: 'OK' },
      body: {
        paymentToken: PAYMENT_TOKEN,
        transactionId: 'pay_1',
        state: 'CANCELED',
        amount: 200_000,
      },
    });
    expect(parsed).toMatchObject({
      authority: PAYMENT_TOKEN,
      reference: 'pay_1',
      outcome: 'CANCELLED',
      amount: AMOUNT,
    });
  });

  it('settles and reverts with the payment token', async () => {
    const { provider, respond, calls } = harness();
    respond(router({ revert: () => declined('3001', 'revert window passed') }));
    const settled = await provider.settlePayment({
      paymentId: 'pay_1',
      authority: PAYMENT_TOKEN,
      providerTransactionId: 'TX-1',
      amount: AMOUNT,
    });
    expect(settled.succeeded).toBe(true);
    expect(jsonBodyOf(callsTo(calls, '/payment/v1/settle')[0]!.init)).toEqual({
      paymentToken: PAYMENT_TOKEN,
    });
    const reverted = await provider.refundPayment({
      paymentId: 'pay_1',
      authority: PAYMENT_TOKEN,
      providerTransactionId: 'TX-1',
      amount: AMOUNT,
      reason: null,
    });
    expect(reverted).toMatchObject({ succeeded: false, errorCode: '3001' });
    expect(jsonBodyOf(callsTo(calls, '/payment/v1/revert')[0]!.init)).toMatchObject({
      paymentToken: PAYMENT_TOKEN,
      amount: AMOUNT,
    });
  });

  it('verifies with the payment token and reports the confirmed amount in IRR', async () => {
    const { provider, respond, calls } = harness({ settings: { amountUnit: 'IRT' } });
    respond(
      router({
        verify: () =>
          jsonResponse({
            successful: true,
            response: { transactionId: 'TX-1', amount: AMOUNT / 10 },
          }),
      }),
    );
    const result = await provider.verifyPayment(verifyRequest(PAYMENT_TOKEN, AMOUNT, null));
    expect(jsonBodyOf(callsTo(calls, '/payment/v1/verify')[0]!.init)).toEqual({
      paymentToken: PAYMENT_TOKEN,
    });
    expect(result).toMatchObject({ status: 'PAID', providerTransactionId: 'TX-1', amount: AMOUNT });
  });

  it('does not advertise an inquiry capability (no status endpoint was reported)', () => {
    expect(SNAPP_PAY_DEFINITION.capabilities).toEqual(['create', 'verify', 'settle', 'refund']);
    expect(SNAPP_PAY_DEFINITION.docsStatus).toBe('UNVERIFIED');
    expect(SNAPP_PAY_DEFINITION.supportsSandbox).toBe(false);
  });
});
