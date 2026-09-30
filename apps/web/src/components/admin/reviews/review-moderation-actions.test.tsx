import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminFa } from '@/i18n/admin-fa';
import { ApiError } from '@/lib/api/errors';
import { ReviewModerationActions } from './review-moderation-actions';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
}));

const patch = vi.fn();
vi.mock('@/lib/api/client', () => ({
  browserApi: { patch: (...args: unknown[]) => patch(...args) },
}));

const copy = adminFa.reviews;

describe('ReviewModerationActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('approves a pending review and refreshes', async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    patch.mockResolvedValue({ id: 'r1', status: 'APPROVED' });
    render(<ReviewModerationActions reviewId="r1" status="PENDING" onChanged={onChanged} />);

    await user.click(screen.getByRole('button', { name: copy.approve }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/admin/reviews/r1/status', {
        status: 'APPROVED',
        note: undefined,
      }),
    );
    expect(await screen.findByText(copy.approved)).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledWith({ id: 'r1', status: 'APPROVED' });
    expect(refresh).toHaveBeenCalled();
  });

  it('asks for an optional note before rejecting and sends it', async () => {
    const user = userEvent.setup();
    patch.mockResolvedValue({ id: 'r1', status: 'REJECTED' });
    render(<ReviewModerationActions reviewId="r1" status="PENDING" compact />);

    expect(screen.queryByLabelText(copy.rejectNote)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: copy.reject }));
    expect(patch).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(copy.rejectNote), 'حاوی اطلاعات تماس');
    await user.click(screen.getByRole('button', { name: copy.confirmReject }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/admin/reviews/r1/status', {
        status: 'REJECTED',
        note: 'حاوی اطلاعات تماس',
      }),
    );
    expect(await screen.findByText(copy.rejected)).toBeInTheDocument();
    expect(screen.queryByLabelText(copy.rejectNote)).not.toBeInTheDocument();
  });

  it('hides the action matching the current status and shows API errors', async () => {
    const user = userEvent.setup();
    patch.mockRejectedValue(new ApiError(404, 'REVIEW_NOT_FOUND', 'x'));
    render(<ReviewModerationActions reviewId="r1" status="APPROVED" />);

    expect(screen.queryByRole('button', { name: copy.approve })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: copy.reject }));
    await user.click(screen.getByRole('button', { name: copy.confirmReject }));

    expect(await screen.findByRole('alert')).toHaveTextContent(adminFa.errors['REVIEW_NOT_FOUND']!);
    expect(refresh).not.toHaveBeenCalled();
  });
});
