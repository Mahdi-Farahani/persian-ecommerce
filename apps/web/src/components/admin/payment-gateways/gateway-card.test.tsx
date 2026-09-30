import type { PaymentGatewayAdminView } from '@pe/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminFa } from '@/i18n/admin-fa';
import { ApiError } from '@/lib/api/errors';
import { GatewayCard } from './gateway-card';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
}));

const api = { patch: vi.fn(), post: vi.fn() };
vi.mock('@/lib/api/client', () => ({
  browserApi: {
    patch: (...args: unknown[]) => api.patch(...args),
    post: (...args: unknown[]) => api.post(...args),
  },
}));

const copy = adminFa.gateways;

const gateway: PaymentGatewayAdminView = {
  provider: 'ZARINPAL',
  displayName: 'زرین‌پال',
  description: 'درگاه زرین‌پال',
  enabled: true,
  isDefault: false,
  environment: 'SANDBOX',
  supportsSandbox: true,
  capabilities: ['create', 'verify', 'refund'],
  docsStatus: 'VERIFIED',
  available: true,
  unavailableReason: null,
  credentialFields: [
    {
      key: 'merchantId',
      label: 'Merchant ID',
      secret: false,
      required: true,
      configured: true,
      maskedValue: 'merchant-123',
    },
    {
      key: 'accessToken',
      label: 'Access Token',
      secret: true,
      required: false,
      configured: true,
      maskedValue: '••••abcd',
    },
  ],
  settingFields: [
    {
      key: 'currency',
      label: 'واحد پول',
      type: 'select',
      options: [
        { value: 'IRR', label: 'ریال' },
        { value: 'IRT', label: 'تومان' },
      ],
      defaultValue: 'IRR',
      value: 'IRT',
    },
  ],
  lastTestedAt: null,
  lastTestSucceeded: null,
  lastTestMessage: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const permissions = { update: true, test: true };

describe('GatewayCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps an untouched secret by sending an empty value', async () => {
    const user = userEvent.setup();
    api.patch.mockResolvedValue({ ...gateway, updatedAt: '2026-01-02T00:00:00.000Z' });
    render(<GatewayCard gateway={gateway} permissions={permissions} />);

    const secret = screen.getByLabelText(/Access Token/);
    expect(secret).toHaveAttribute('type', 'password');
    expect(secret).toHaveAttribute('placeholder', '••••abcd');
    expect(secret).toHaveValue('');
    expect(screen.getByLabelText('Merchant ID')).toHaveValue('merchant-123');

    await user.click(screen.getByRole('button', { name: copy.save }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/admin/payment-gateways/zarinpal', {
        enabled: true,
        environment: 'SANDBOX',
        credentials: { merchantId: 'merchant-123', accessToken: '' },
        settings: { currency: 'IRT' },
      }),
    );
    expect(await screen.findByText(copy.saved)).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it('asks for confirmation before switching to production and resubmits', async () => {
    const user = userEvent.setup();
    api.patch
      .mockRejectedValueOnce(new ApiError(422, 'PAYMENT_GATEWAY_CONFIRM_PRODUCTION', 'confirm'))
      .mockResolvedValueOnce({ ...gateway, environment: 'PRODUCTION' });
    render(<GatewayCard gateway={gateway} permissions={permissions} />);

    await user.selectOptions(screen.getByLabelText(copy.environment), 'PRODUCTION');
    await user.type(screen.getByLabelText(/Access Token/), 'new-secret');
    await user.click(screen.getByRole('button', { name: copy.save }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(copy.confirmProductionBody);
    expect(api.patch).toHaveBeenCalledTimes(1);
    expect(api.patch.mock.calls[0]?.[1]).not.toHaveProperty('confirmProduction');

    await user.click(screen.getByRole('button', { name: copy.confirmProduction }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(2));
    expect(api.patch).toHaveBeenLastCalledWith('/admin/payment-gateways/zarinpal', {
      enabled: true,
      environment: 'PRODUCTION',
      credentials: { merchantId: 'merchant-123', accessToken: 'new-secret' },
      settings: { currency: 'IRT' },
      confirmProduction: true,
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText(copy.productionWarning)).toBeInTheDocument();
  });

  it('runs a connection test and shows the result', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({
      ok: false,
      message: 'Merchant not found',
      testedAt: '2026-01-03T00:00:00.000Z',
    });
    render(<GatewayCard gateway={gateway} permissions={permissions} />);

    await user.click(screen.getByRole('button', { name: copy.testConnection }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/payment-gateways/zarinpal/test', {}),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Merchant not found');
    expect(screen.getByText(copy.lastTestFailed)).toBeInTheDocument();
  });
});
