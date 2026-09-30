import { PaymentErrorCodes, PaymentProviderError } from '../payment.errors.js';
import {
  DIGIPAY_AGENT_HEADER,
  DIGIPAY_DEFINITION,
  DIGIPAY_SANDBOX_BASE_URL,
  DIGIPAY_VERSION_HEADER,
  DigiPayPaymentProvider,
} from './digipay.provider.js';
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

/**
 * Response shapes below are the adapter's UNVERIFIED assumptions (see
 * docs/payments/DIGIPAY.md); only `payUrl`, the callback `amount`/`providerId`,
 * the two headers and the 401 semantics are SNIPPET-confirmed.
 */
const CREDENTIALS = {
  clientId: 'digipay-client-id-XYZ',
  clientSecret: 'digipay-client-secret-SECRET',
  username: 'merchant-user-USR',
  password: 'merchant-pass-PWD',
};
const SECRETS = Object.values(CREDENTIALS);
const AMOUNT = 1_000_000;
const TICKET = 'TICKET-1';
const TRACKING = 'TRK-1';
const PAY_URL = 'https://uat.mydigipay.info/pay/TICKET-1';

const tokenOk = () =>
  jsonResponse({ access_token: 'tok-1', token_type: 'bearer', expires_in: 3600 });
const ticketOk = () => jsonResponse({ payUrl: PAY_URL, ticket: TICKET, result: { status: 0 } });
const verifyOk = () =>
  jsonResponse({
    result: { status: 0, message: 'ok' },
    trackingCode: TRACKING,
    amount: AMOUNT,
    providerId: 'pay_1',
    rrn: '998877',
  });
const verifyDeclined = (message: string, status = 200) =>
  jsonResponse({ result: { status: 1, message, title: 'خطا' } }, status);

/** Routes token/ticket/verify calls by path; unmatched paths get 404. */
function router(
  routes: Partial<Record<'token' | 'ticket' | 'verify' | 'refund', FetchHandler>>,
): FetchHandler {
  return (url, init) => {
    const path = pathOf(url);
    if (path.endsWith('/oauth/token')) return (routes.token ?? tokenOk)(url, init);
    if (path.endsWith('/tickets/business')) return (routes.ticket ?? ticketOk)(url, init);
    if (path.includes('/purchases/verify/')) return (routes.verify ?? verifyOk)(url, init);
    if (path.endsWith('/refunds'))
      return (routes.refund ?? (() => jsonResponse({ result: { status: 0 } })))(url, init);
    return jsonResponse({ message: 'unexpected path' }, 404);
  };
}

function harness(overrides: Parameters<typeof contextFor>[1] = {}) {
  const stub = stubHttp('DIGIPAY');
  const context = contextFor(DIGIPAY_DEFINITION, {
    credentials: CREDENTIALS,
    ...overrides,
    settings: { contractDocsConfirmed: 'yes', ...overrides.settings },
  });
  return { ...stub, provider: new DigiPayPaymentProvider(context, stub.http) };
}

const okCallback = {
  method: 'POST' as const,
  query: { paymentId: 'pay_1' },
  body: { trackingCode: TRACKING, providerId: 'pay_1', amount: String(AMOUNT), status: 'SUCCESS' },
};

runProviderContractSuite('DigiPay', () => {
  const { provider, respond } = harness();
  return {
    provider,
    respond,
    fixtures: {
      amount: AMOUNT,
      authority: TICKET,
      unknownAuthority: 'UNKNOWN-TICKET',
      callbacks: {
        ok: okCallback,
        failed: { ...okCallback, body: { ...okCallback.body, status: 'FAILED' } },
        garbage: { method: 'GET', query: { foo: 'bar' }, body: {} },
        echoedAmount: { payload: okCallback, expectedIrr: AMOUNT },
      },
      scenarios: {
        createSuccess: router({}),
        invalidCredentials: router({ token: () => jsonResponse({ error: 'unauthorized' }, 401) }),
        providerError: router({
          ticket: () =>
            jsonResponse({ result: { status: 2, message: 'شماره موبایل نامعتبر' } }, 400),
        }),
        verifySuccess: router({}),
        verifyFailed: router({ verify: () => verifyDeclined('پرداخت ناموفق') }),
        verifyDuplicate: () => {
          let verifies = 0;
          return router({
            verify: () => (verifies++ === 0 ? verifyOk() : verifyDeclined('already verified')),
          });
        },
        verifyUnknownAuthority: router({ verify: () => verifyDeclined('not found', 404) }),
      },
      secrets: SECRETS,
    },
  };
});

describe('DigiPayPaymentProvider', () => {
  const ticketCalls = (calls: RecordedCall[]) =>
    calls.filter((c) => pathOf(c.url).endsWith('/tickets/business'));
  const tokenCalls = (calls: RecordedCall[]) =>
    calls.filter((c) => pathOf(c.url).endsWith('/oauth/token'));

  it('exchanges credentials with the password grant and HTTP Basic client auth', async () => {
    const { provider, respond, calls } = harness();
    respond(router({}));
    await provider.createPayment(createRequest(AMOUNT));
    const [token] = tokenCalls(calls);
    expect(token!.url).toBe(`${DIGIPAY_SANDBOX_BASE_URL}/oauth/token`);
    expect(token!.init.method).toBe('POST');
    expect(headerOf(token!.init, 'authorization')).toBe(
      `Basic ${Buffer.from(`${CREDENTIALS.clientId}:${CREDENTIALS.clientSecret}`).toString('base64')}`,
    );
    expect(headerOf(token!.init, 'content-type')).toBe('application/x-www-form-urlencoded');
    expect(formBodyOf(token!.init)).toEqual({
      grant_type: 'password',
      username: CREDENTIALS.username,
      password: CREDENTIALS.password,
    });
  });

  it('creates a ticket with the SNIPPET headers, bearer token, type query and toman amount', async () => {
    const { provider, respond, calls } = harness({
      settings: { ticketType: '11', amountUnit: 'IRT' },
    });
    respond(router({}));
    const result = await provider.createPayment(createRequest(AMOUNT));
    const [ticket] = ticketCalls(calls);
    expect(ticket!.url).toBe(`${DIGIPAY_SANDBOX_BASE_URL}/tickets/business?type=11`);
    expect(headerOf(ticket!.init, 'Agent')).toBe(DIGIPAY_AGENT_HEADER);
    expect(headerOf(ticket!.init, 'Digipay-Version')).toBe(DIGIPAY_VERSION_HEADER);
    expect(headerOf(ticket!.init, 'authorization')).toBe('Bearer tok-1');
    expect(headerOf(ticket!.init, 'content-type')).toBe('application/json');
    expect(jsonBodyOf(ticket!.init)).toMatchObject({
      amount: AMOUNT / 10,
      cellNumber: '09123456789',
      providerId: 'pay_1',
      redirectUrl: 'https://api.example.test/payments/callback?paymentId=pay_1',
    });
    expect(result).toMatchObject({
      authority: TICKET,
      redirectUrl: PAY_URL,
      redirectMethod: 'GET',
    });
  });

  it('omits the type query when no ticket type is configured', async () => {
    const { provider, respond, calls } = harness();
    respond(router({}));
    await provider.createPayment(createRequest(AMOUNT));
    expect(ticketCalls(calls)[0]!.url).toBe(`${DIGIPAY_SANDBOX_BASE_URL}/tickets/business`);
  });

  it('uses the production base URL in production', async () => {
    const { provider, respond, calls } = harness({ environment: 'PRODUCTION' });
    respond(router({}));
    await provider.createPayment(createRequest(AMOUNT));
    expect(tokenCalls(calls)[0]!.url).toBe('https://api.mydigipay.com/digipay/api/oauth/token');
  });

  it('refreshes the token once and retries once on 401', async () => {
    const { provider, respond, calls } = harness();
    let tokens = 0;
    respond(
      router({
        token: () => jsonResponse({ access_token: `tok-${++tokens}`, expires_in: 3600 }),
        ticket: (_url, init) =>
          headerOf(init, 'authorization') === 'Bearer tok-2'
            ? ticketOk()
            : jsonResponse({ result: { status: 401, message: 'expired' } }, 401),
      }),
    );
    const result = await provider.createPayment(createRequest(AMOUNT));
    expect(result.authority).toBe(TICKET);
    expect(tokenCalls(calls)).toHaveLength(2);
    expect(ticketCalls(calls).map((c) => headerOf(c.init, 'authorization'))).toEqual([
      'Bearer tok-1',
      'Bearer tok-2',
    ]);
  });

  it('reports INVALID_CREDENTIALS when the retry is still 401', async () => {
    const { provider, respond, calls } = harness();
    respond(router({ ticket: () => jsonResponse({ message: 'expired' }, 401) }));
    await expect(provider.createPayment(createRequest(AMOUNT))).rejects.toMatchObject({
      code: PaymentErrorCodes.InvalidCredentials,
    });
    expect(ticketCalls(calls)).toHaveLength(2);
  });

  it('memoizes the token across operations of one instance', async () => {
    const { provider, respond, calls } = harness();
    respond(router({}));
    await provider.createPayment(createRequest(AMOUNT));
    await provider.verifyPayment(verifyRequest(TICKET, AMOUNT, provider.parseCallback(okCallback)));
    expect(tokenCalls(calls)).toHaveLength(1);
  });

  it('maps a 401 on the token call itself to INVALID_CREDENTIALS', async () => {
    const { provider, respond } = harness();
    respond(router({ token: () => jsonResponse({ error: 'invalid_client' }, 401) }));
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
  });

  it('throws Misconfigured when the base URL for the environment is empty', async () => {
    const { provider } = harness({
      environment: 'PRODUCTION',
      settings: { productionBaseUrl: '' },
    });
    await expect(provider.createPayment(createRequest(AMOUNT))).rejects.toMatchObject({
      code: PaymentErrorCodes.Misconfigured,
    });
  });

  it('never leaks credentials or tokens into errors, even when the provider echoes them', async () => {
    const { provider, respond } = harness();
    respond(
      router({
        token: () =>
          jsonResponse(
            {
              error: 'invalid_grant',
              error_description: `bad password ${CREDENTIALS.password} for ${CREDENTIALS.username}`,
              client_secret: CREDENTIALS.clientSecret,
              access_token: 'should-not-leak',
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
    for (const secret of [...SECRETS, 'should-not-leak']) expect(text).not.toContain(secret);
  });

  it('strips echoed secrets from create results and callback raw payloads', async () => {
    const { provider, respond } = harness();
    respond(
      router({
        ticket: () =>
          jsonResponse({ payUrl: PAY_URL, ticket: TICKET, password: CREDENTIALS.password }),
      }),
    );
    const result = await provider.createPayment(createRequest(AMOUNT));
    expect(JSON.stringify(result.raw)).not.toContain(CREDENTIALS.password);
    const parsed = provider.parseCallback({
      method: 'POST',
      query: {},
      body: { trackingCode: TRACKING, token: 'leaked-token', note: CREDENTIALS.clientSecret },
    });
    expect(JSON.stringify(parsed.raw)).not.toContain('leaked-token');
    expect(JSON.stringify(parsed.raw)).not.toContain(CREDENTIALS.clientSecret);
  });

  it('converts the echoed callback amount from toman to rial', () => {
    const { provider } = harness({ settings: { amountUnit: 'IRT' } });
    const parsed = provider.parseCallback({
      method: 'POST',
      query: {},
      body: { trackingCode: TRACKING, providerId: 'pay_1', amount: 100_000 },
    });
    expect(parsed).toMatchObject({
      authority: null,
      providerTransactionId: TRACKING,
      reference: 'pay_1',
      amount: AMOUNT,
      outcome: 'UNKNOWN',
    });
  });

  it('merges POST body over GET query and maps cancel words', () => {
    const { provider } = harness();
    const parsed = provider.parseCallback({
      method: 'POST',
      query: { status: 'SUCCESS', trackingCode: 'from-query' },
      body: { status: 'CANCELED', trackingCode: TRACKING },
    });
    expect(parsed.outcome).toBe('CANCELLED');
    expect(parsed.providerTransactionId).toBe(TRACKING);
  });

  it('verifies with the callback tracking code and the type query', async () => {
    const { provider, respond, calls } = harness({ settings: { ticketType: '0' } });
    respond(router({}));
    const result = await provider.verifyPayment(
      verifyRequest(TICKET, AMOUNT, provider.parseCallback(okCallback)),
    );
    const verifyCall = calls.find((c) => pathOf(c.url).includes('/purchases/verify/'))!;
    expect(verifyCall.url).toBe(`${DIGIPAY_SANDBOX_BASE_URL}/purchases/verify/${TRACKING}?type=0`);
    expect(headerOf(verifyCall.init, 'Agent')).toBe(DIGIPAY_AGENT_HEADER);
    expect(result).toMatchObject({
      status: 'PAID',
      providerTransactionId: TRACKING,
      amount: AMOUNT,
      alreadyVerified: false,
    });
  });

  it('fails verification when the echoed providerId belongs to another payment', async () => {
    const { provider, respond } = harness();
    respond(
      router({
        verify: () =>
          jsonResponse({
            result: { status: 0 },
            trackingCode: TRACKING,
            providerId: 'someone-else',
          }),
      }),
    );
    const result = await provider.verifyPayment(verifyRequest(TICKET, AMOUNT, null));
    expect(result).toMatchObject({
      status: 'FAILED',
      errorCode: PaymentErrorCodes.TransactionMismatch,
    });
  });

  it('throws a retryable ProviderUnavailable on 5xx during verify', async () => {
    const { provider, respond } = harness();
    respond(router({ verify: () => jsonResponse({ message: 'down' }, 503) }));
    await expect(provider.verifyPayment(verifyRequest(TICKET, AMOUNT, null))).rejects.toMatchObject(
      {
        code: PaymentErrorCodes.ProviderUnavailable,
        retryable: true,
      },
    );
  });

  it('posts a refund with the tracking code and reports provider declines', async () => {
    const { provider, respond, calls } = harness();
    respond(
      router({
        refund: () => jsonResponse({ result: { status: 7, message: 'مهلت ۲۵ دقیقه گذشته' } }, 400),
      }),
    );
    const outcome = await provider.refundPayment({
      paymentId: 'pay_1',
      authority: TICKET,
      providerTransactionId: TRACKING,
      amount: AMOUNT,
      reason: 'customer request',
    });
    const refundCall = calls.find((c) => pathOf(c.url).endsWith('/refunds'))!;
    expect(jsonBodyOf(refundCall.init)).toMatchObject({
      trackingCode: TRACKING,
      providerId: 'pay_1',
      amount: AMOUNT,
    });
    expect(outcome).toMatchObject({ succeeded: false, errorCode: '7' });
  });
});
