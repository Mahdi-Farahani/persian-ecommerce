import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminFa } from '@/i18n/admin-fa';
import { ApiError } from '@/lib/api/errors';
import { formatCommissionPercent, percentToBps, bpsToPercent } from '@/lib/admin/sellers';
import { SellerCommissionForm } from './seller-commission-form';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
}));

const patch = vi.fn();
vi.mock('@/lib/api/client', () => ({
  browserApi: { patch: (...args: unknown[]) => patch(...args) },
}));

const copy = adminFa.sellers.commission;

describe('commission conversion helpers', () => {
  it('converts between percent and basis points without floating point drift', () => {
    expect(percentToBps(12.5)).toBe(1250);
    expect(percentToBps(0.01)).toBe(1);
    expect(percentToBps(50)).toBe(5000);
    expect(bpsToPercent(1250)).toBe(12.5);
    expect(bpsToPercent(1000)).toBe(10);
  });

  it('formats basis points as a Persian percent', () => {
    expect(formatCommissionPercent(1000)).toBe('۱۰٪');
    expect(formatCommissionPercent(1250)).toBe('۱۲٫۵٪');
    expect(formatCommissionPercent(0)).toBe('۰٪');
  });
});

describe('SellerCommissionForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the stored basis points as a percent', () => {
    render(<SellerCommissionForm sellerId="s1" commissionBps={1250} />);
    expect(screen.getByLabelText(copy.percent)).toHaveValue('12.5');
    expect(screen.getByText(copy.current('۱۲٫۵٪'))).toBeInTheDocument();
  });

  it('sends the typed percent (Persian digits and decimals accepted) as basis points', async () => {
    const user = userEvent.setup();
    patch.mockResolvedValue({ id: 's1', commissionBps: 1575 });
    render(<SellerCommissionForm sellerId="s1" commissionBps={1000} />);

    const input = screen.getByLabelText(copy.percent);
    await user.clear(input);
    await user.type(input, '۱۵٫۷۵');
    await user.click(screen.getByRole('button', { name: copy.save }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/admin/sellers/s1/commission', { commissionBps: 1575 }),
    );
    expect(await screen.findByText(copy.saved)).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it('rejects percents above the maximum and more than two decimals before calling the API', async () => {
    const user = userEvent.setup();
    render(<SellerCommissionForm sellerId="s1" commissionBps={1000} />);

    const input = screen.getByLabelText(copy.percent);
    await user.clear(input);
    await user.type(input, '51');
    await user.click(screen.getByRole('button', { name: copy.save }));
    expect(await screen.findByText(adminFa.validation.commissionRange('۵۰'))).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, '12.345');
    await user.click(screen.getByRole('button', { name: copy.save }));
    expect(await screen.findByText(adminFa.validation.twoDecimals)).toBeInTheDocument();

    expect(patch).not.toHaveBeenCalled();
  });

  it('shows the API error message when the update is refused', async () => {
    const user = userEvent.setup();
    patch.mockRejectedValue(new ApiError(404, 'SELLER_NOT_FOUND', 'x'));
    render(<SellerCommissionForm sellerId="s1" commissionBps={1000} />);

    await user.click(screen.getByRole('button', { name: copy.save }));

    expect(await screen.findByText(adminFa.errors['SELLER_NOT_FOUND']!)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
