import { PaymentErrorCodes } from '../payment.errors.js';
import {
  contextFor,
  createRequest,
  headerOf,
  jsonBodyOf,
  jsonResponse,
  runProviderContractSuite,
  stubHttp,
  verifyRequest,
  type FetchHandler,
} from './provider-contract.suite.js';
import {
  ZARINPAL_DEFINITION,
  ZARINPAL_PRODUCTION_BASE_URL,
  ZARINPAL_SANDBOX_BASE_URL,
  ZarinPalPaymentProvider,
} from './zarinpal.provider.js';

/** Shapes below are VERIFIED against the official SDK sources (docs/payments/research/ZARINPAL.md). */
const MERCHANT_ID = '3f5a1d2e-9b8c-4a7d-8e6f-1a2b3c4d5e6f';
const AUTHORITY = `S${'0'.repeat(30)}12345`;
const AMOUNT = 1_000_000;

const ok = (data: Record<string, unknown>) => jsonResponse({ data, errors: [] });
const fail = (code: number, message: string) =>
  jsonResponse({ data: [], errors: { code, message, validations: [] } });

const requestOk: FetchHandler = () =>
  ok({ code: 100, message: 'Success', authority: AUTHORITY, fee_type: 'Merchant', fee: 0 });
const verifyOk: FetchHandler = () =>
  ok({ code: 100, message: 'Verified', ref_id: 123456789, card_pan: '603799******0001' });
const verifyAlready: FetchHandler = () => ok({ code: 101, message: 'Verified', ref_id: 123456789 });
const notPaid: FetchHandler = () =>
  fail(-51, 'Session is not valid, session is not active paid try');

function harness(overrides: Parameters<typeof contextFor>[1] = {}) {
  const stub = stubHttp('ZARINPAL');
  const context = contextFor(ZARINPAL_DEFINITION, {
    credentials: { merchantId: MERCHANT_ID },
    ...overrides,
  });
  return { ...stub, provider: new ZarinPalPaymentProvider(context, stub.http) };
}

runProviderContractSuite('ZarinPal', () => {
  const { provider, respond } = harness();
  return {
    provider,
    respond,
    fixtures: {
      amount: AMOUNT,
      authority: AUTHORITY,
      unknownAuthority: `A${'9'.repeat(35)}`,
      callbacks: {
        ok: { method: 'GET', query: { Authority: AUTHORITY, Status: 'OK' }, body: {} },
        failed: { method: 'GET', query: { Authority: AUTHORITY, Status: 'NOK' }, body: {} },
        garbage: { method: 'GET', query: { foo: 'bar' }, body: {} },
        echoedAmount: null,
      },
      scenarios: {
        createSuccess: requestOk,
        invalidCredentials: () => fail(-74, 'The merchant id is invalid'),
        providerError: () => fail(-9, 'Validation error'),
        verifySuccess: verifyOk,
        verifyFailed: notPaid,
        verifyDuplicate: () => {
          let calls = 0;
          return () => (calls++ === 0 ? verifyOk : verifyAlready)('', {});
        },
        verifyUnknownAuthority: notPaid,
      },
      secrets: [MERCHANT_ID],
    },
  };
});

describe('ZarinPalPaymentProvider', () => {
  it('posts the request.json body with the merchant id, IRR amount and callback', async () => {
    const { provider, respond, calls } = harness();
    respond(requestOk);
    const result = await provider.createPayment(createRequest(AMOUNT));
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(`${ZARINPAL_SANDBOX_BASE_URL}/pg/v4/payment/request.json`);
    expect(headerOf(calls[0]!.init, 'content-type')).toBe('application/json');
    expect(jsonBodyOf(calls[0]!.init)).toMatchObject({
      merchant_id: MERCHANT_ID,
      amount: AMOUNT,
      currency: 'IRR',
      callback_url: 'https://api.example.test/payments/callback?paymentId=pay_1',
      metadata: { order_id: 'PE-1001', mobile: '09123456789', email: 'buyer@example.test' },
    });
    expect(result.redirectUrl).toBe(`${ZARINPAL_SANDBOX_BASE_URL}/pg/StartPay/${AUTHORITY}`);
  });

  it('converts to toman when the currency setting is IRT and uses the production host', async () => {
    const { provider, respond, calls } = harness({
      environment: 'PRODUCTION',
      settings: { currency: 'IRT' },
    });
    respond(requestOk);
    await provider.createPayment(createRequest(AMOUNT));
    expect(calls[0]!.url).toBe(`${ZARINPAL_PRODUCTION_BASE_URL}/pg/v4/payment/request.json`);
    expect(jsonBodyOf(calls[0]!.init)).toMatchObject({ amount: AMOUNT / 10, currency: 'IRT' });
  });

  it('reports code 101 as already verified', async () => {
    const { provider, respond } = harness();
    respond(verifyAlready);
    const result = await provider.verifyPayment(verifyRequest(AUTHORITY, AMOUNT, null));
    expect(result).toMatchObject({
      status: 'PAID',
      alreadyVerified: true,
      providerTransactionId: '123456789',
    });
  });

  it('rejects authorities that do not match the documented pattern in callbacks', () => {
    const { provider } = harness();
    const parsed = provider.parseCallback({
      method: 'GET',
      query: { Authority: 'short', Status: 'OK' },
      body: {},
    });
    expect(parsed.authority).toBeNull();
    expect(parsed.outcome).toBe('OK');
  });

  it('throws Misconfigured without a merchant id', async () => {
    const { provider } = harness({ credentials: {} });
    await expect(provider.createPayment(createRequest(AMOUNT))).rejects.toMatchObject({
      code: PaymentErrorCodes.Misconfigured,
    });
  });
});
