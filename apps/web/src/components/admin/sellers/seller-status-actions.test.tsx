import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminFa } from '@/i18n/admin-fa';
import { ApiError } from '@/lib/api/errors';
import { SellerStatusActions } from './seller-status-actions';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
}));

const patch = vi.fn();
vi.mock('@/lib/api/client', () => ({
  browserApi: { patch: (...args: unknown[]) => patch(...args) },
}));

const copy = adminFa.sellers;

describe('SellerStatusActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('approves a pending seller and refreshes', async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    patch.mockResolvedValue({ id: 's1', status: 'APPROVED' });
    render(<SellerStatusActions sellerId="s1" status="PENDING" onChanged={onChanged} />);

    // A pending application cannot be suspended, only approved or rejected.
    expect(screen.queryByRole('button', { name: copy.suspend })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: copy.approve }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/admin/sellers/s1/status', {
        status: 'APPROVED',
        reason: undefined,
      }),
    );
    expect(await screen.findByText(copy.approved)).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledWith({ id: 's1', status: 'APPROVED' });
    expect(refresh).toHaveBeenCalled();
  });

  it('asks for a reason before rejecting and sends it', async () => {
    const user = userEvent.setup();
    patch.mockResolvedValue({ id: 's1', status: 'REJECTED' });
    render(<SellerStatusActions sellerId="s1" status="PENDING" />);

    expect(screen.queryByLabelText(copy.rejectReason)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: copy.reject }));
    expect(patch).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(copy.rejectReason), 'مدارک ناقص است');
    await user.click(screen.getByRole('button', { name: copy.confirmReject }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/admin/sellers/s1/status', {
        status: 'REJECTED',
        reason: 'مدارک ناقص است',
      }),
    );
    expect(await screen.findByText(copy.rejected)).toBeInTheDocument();
    expect(screen.queryByLabelText(copy.rejectReason)).not.toBeInTheDocument();
  });

  it('suspends an approved seller only after confirmation', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    patch.mockResolvedValue({ id: 's1', status: 'SUSPENDED' });
    render(<SellerStatusActions sellerId="s1" status="APPROVED" />);

    // Approved sellers cannot be approved again or rejected.
    expect(screen.queryByRole('button', { name: copy.approve })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.reject })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: copy.suspend }));
    expect(confirm).toHaveBeenCalledWith(copy.suspendConfirm);
    expect(patch).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: copy.suspend }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/admin/sellers/s1/status', {
        status: 'SUSPENDED',
        reason: undefined,
      }),
    );
    expect(await screen.findByText(copy.suspended)).toBeInTheDocument();
  });

  it('shows the API error when the transition is refused', async () => {
    const user = userEvent.setup();
    patch.mockRejectedValue(new ApiError(422, 'SELLER_STATUS_UNCHANGED', 'x'));
    render(<SellerStatusActions sellerId="s1" status="SUSPENDED" />);

    await user.click(screen.getByRole('button', { name: copy.approve }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      adminFa.errors['SELLER_STATUS_UNCHANGED']!,
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});
