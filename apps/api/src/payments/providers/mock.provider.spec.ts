import { MOCK_DECLINED_AMOUNT, MOCK_DEFINITION, MockPaymentProvider } from './mock.provider.js';
import {
  contextFor,
  createRequest,
  runProviderContractSuite,
  verifyRequest,
} from './provider-contract.suite.js';

const GATEWAY_URL = 'http://localhost:4000/payments/mock/gateway';
const AUTHORITY = 'MOCK-0123456789abcdef01234567';

runProviderContractSuite('Mock', () => ({
  provider: new MockPaymentProvider(contextFor(MOCK_DEFINITION), GATEWAY_URL),
  respond: () => undefined,
  fixtures: {
    amount: 1_000_000,
    authority: AUTHORITY,
    unknownAuthority: 'NOT-A-MOCK-AUTHORITY',
    callbacks: {
      ok: { method: 'GET', query: { authority: AUTHORITY, status: 'OK' }, body: {} },
      failed: { method: 'GET', query: { authority: AUTHORITY, status: 'FAIL' }, body: {} },
      garbage: { method: 'GET', query: { foo: 'bar' }, body: {} },
      echoedAmount: null,
    },
    scenarios: null,
    secrets: [],
  },
}));

describe('MockPaymentProvider', () => {
  it('builds a gateway URL carrying the authority, amount and auto outcome', async () => {
    const provider = new MockPaymentProvider(
      contextFor(MOCK_DEFINITION, { settings: { autoOutcome: 'success' } }),
      GATEWAY_URL,
    );
    const result = await provider.createPayment(createRequest(50_000));
    const url = new URL(result.redirectUrl);
    expect(url.searchParams.get('authority')).toBe(result.authority);
    expect(url.searchParams.get('amount')).toBe('50000');
    expect(url.searchParams.get('auto')).toBe('success');
  });

  it('rejects amounts below the minimum', async () => {
    const provider = new MockPaymentProvider(contextFor(MOCK_DEFINITION), GATEWAY_URL);
    await expect(provider.createPayment(createRequest(1_000))).rejects.toMatchObject({
      code: 'PROVIDER_REJECTED',
    });
  });

  it('declines the sentinel amount at verification', async () => {
    const provider = new MockPaymentProvider(contextFor(MOCK_DEFINITION), GATEWAY_URL);
    const callback = provider.parseCallback({
      method: 'GET',
      query: { authority: AUTHORITY, status: 'OK' },
      body: {},
    });
    const result = await provider.verifyPayment(
      verifyRequest(AUTHORITY, MOCK_DECLINED_AMOUNT, callback),
    );
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'MOCK_DECLINED' });
  });

  it('treats NOK as a cancellation', () => {
    const provider = new MockPaymentProvider(contextFor(MOCK_DEFINITION), GATEWAY_URL);
    const parsed = provider.parseCallback({
      method: 'POST',
      query: {},
      body: { authority: AUTHORITY, status: 'NOK' },
    });
    expect(parsed.outcome).toBe('CANCELLED');
  });
});
