import type { PaymentView } from '@pe/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { PaymentPending } from './payment-pending';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
}));

const api = { get: vi.fn(), post: vi.fn() };
vi.mock('@/lib/api/client', () => ({
  browserApi: {
    get: (...args: unknown[]) => api.get(...args),
    post: (...args: unknown[]) => api.post(...args),
  },
}));

function payment(status: PaymentView['status']): PaymentView {
  return {
    id: 'pay-1',
    orderId: 'order-1',
    orderNumber: 'PE-000001',
    provider: 'MOCK',
    environment: 'SANDBOX',
    attemptNumber: 1,
    amount: 1_000_000,
    currency: 'IRR',
    status,
    providerAuthority: 'A1',
    providerTransactionId: null,
    cardPanMask: null,
    errorCode: null,
    errorMessage: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    verifiedAt: null,
  };
}

describe('PaymentPending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('polls until the backend reports success and routes to the success page', async () => {
    api.get.mockResolvedValueOnce(payment('VERIFYING')).mockResolvedValueOnce(payment('PAID'));
    render(<PaymentPending paymentId="pay-1" intervalMs={10} timeoutMs={5_000} />);
    expect(screen.getByRole('status')).toHaveTextContent(t.payment.pendingBody);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/payment/success?paymentId=pay-1'));
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(api.get).toHaveBeenCalledWith('/payments/pay-1');
  });

  it('routes to the failure page after a manual verification', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(payment('VERIFYING'));
    api.post.mockResolvedValue(payment('FAILED'));
    render(<PaymentPending paymentId="pay-1" intervalMs={10_000} timeoutMs={20_000} />);

    await user.click(screen.getByRole('button', { name: t.payment.checkStatus }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/payments/pay-1/verify', {}));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/payment/failure?paymentId=pay-1'));
  });

  it('stops polling and explains after the timeout', async () => {
    api.get.mockResolvedValue(payment('REDIRECTED'));
    render(<PaymentPending paymentId="pay-1" intervalMs={10} timeoutMs={30} />);
    expect(await screen.findByText(t.payment.pendingTimedOut)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
