import type { CheckoutQuote, PaymentProviderInfo } from '@pe/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/toast';
import { t } from '@/i18n';
import { ApiError } from '@/lib/api/errors';
import { useCartStore } from '@/store/cart-store';
import { PaymentStep } from './payment-step';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

const api = { get: vi.fn(), post: vi.fn() };
vi.mock('@/lib/api/client', () => ({
  browserApi: {
    get: (...args: unknown[]) => api.get(...args),
    post: (...args: unknown[]) => api.post(...args),
  },
}));

const redirectToGateway = vi.fn();
vi.mock('@/lib/payments/redirect', () => ({
  redirectToGateway: (...args: unknown[]) => redirectToGateway(...args),
}));

const providers: PaymentProviderInfo[] = [
  {
    provider: 'ZARINPAL',
    displayName: 'زرین‌پال',
    description: 'پرداخت با کارت‌های عضو شتاب',
    environment: 'PRODUCTION',
    isDefault: false,
  },
  {
    provider: 'MOCK',
    displayName: 'درگاه آزمایشی',
    description: 'برای تست',
    environment: 'SANDBOX',
    isDefault: true,
  },
];

const quote: CheckoutQuote = {
  cart: {
    id: 'c1',
    items: [],
    coupon: null,
    totals: { subtotal: 0, discount: 0, total: 0, itemCount: 0, currency: 'IRR' },
    warnings: [],
    updatedAt: '',
  },
  address: {
    id: 'addr-1',
    title: 'خانه',
    recipientName: 'علی',
    recipientPhone: '09120000000',
    province: 'تهران',
    city: 'تهران',
    addressLine: 'خیابان',
    postalCode: '1234567890',
  },
  shippingMethod: {
    id: 's1',
    code: 'post',
    name: 'پست',
    description: null,
    baseFee: 0,
    freeAboveAmount: null,
    fee: 0,
    estimatedDaysMin: 1,
    estimatedDaysMax: 3,
  },
  totals: {
    subtotal: 0,
    discount: 0,
    total: 0,
    itemCount: 0,
    currency: 'IRR',
    shippingFee: 0,
    grandTotal: 0,
  },
  issues: [],
  canPlaceOrder: true,
};

function renderStep() {
  return render(
    <ToastProvider>
      <PaymentStep quote={quote} />
    </ToastProvider>,
  );
}

describe('PaymentStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCartStore.setState({ cart: quote.cart, loaded: true, loading: false });
  });

  it('preselects the default provider and lets the customer pick another', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(providers);
    api.post.mockResolvedValueOnce({ id: 'order-1', number: 'PE-000001' }).mockResolvedValueOnce({
      payment: { id: 'pay-1' },
      redirectUrl: 'https://gateway.example/pay',
      redirectMethod: 'GET',
    });
    renderStep();

    const mock = await screen.findByRole('radio', { name: /درگاه آزمایشی/ });
    expect(mock).toBeChecked();
    expect(api.get).toHaveBeenCalledWith('/payments/providers');

    await user.click(screen.getByRole('radio', { name: /زرین‌پال/ }));
    await user.click(screen.getByRole('button', { name: t.checkout.placeOrderAndPay }));

    await waitFor(() => expect(redirectToGateway).toHaveBeenCalled());
    expect(api.post).toHaveBeenNthCalledWith(1, '/checkout', {
      addressId: 'addr-1',
      shippingMethodCode: 'post',
      note: undefined,
    });
    expect(api.post).toHaveBeenNthCalledWith(2, '/payments', {
      orderId: 'order-1',
      provider: 'ZARINPAL',
    });
    expect(useCartStore.getState().cart).toBeNull();
  });

  it('disables ordering when no gateway is available', async () => {
    api.get.mockResolvedValue([]);
    renderStep();
    expect(await screen.findByText(t.checkout.noProviders)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.checkout.placeOrderAndPay })).toBeDisabled();
  });

  it('sends the customer to the order page when the gateway fails after ordering', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(providers);
    api.post
      .mockResolvedValueOnce({ id: 'order-2', number: 'PE-000002' })
      .mockRejectedValueOnce(new ApiError(502, 'PAYMENT_GATEWAY_ERROR', 'gateway down'));
    renderStep();

    await screen.findByRole('radio', { name: /درگاه آزمایشی/ });
    await user.click(screen.getByRole('button', { name: t.checkout.placeOrderAndPay }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/account/orders/order-2'));
    expect(redirectToGateway).not.toHaveBeenCalled();
    expect(await screen.findByText(t.auth.errors['PAYMENT_GATEWAY_ERROR']!)).toBeInTheDocument();
  });
});
