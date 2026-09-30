import type { AdminSettlementView } from '@pe/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminFa } from '@/i18n/admin-fa';
import { ApiError } from '@/lib/api/errors';
import { SettlementActions } from './settlement-actions';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
}));

const patch = vi.fn();
vi.mock('@/lib/api/client', () => ({
  browserApi: { patch: (...args: unknown[]) => patch(...args) },
}));

const copy = adminFa.settlements;

const settlement: AdminSettlementView = {
  id: 'st1',
  sellerId: 's1',
  seller: { id: 's1', storeName: 'فروشگاه نمونه', slug: 'sample-store' },
  status: 'PENDING',
  grossAmount: 10_000_000,
  commissionAmount: 1_000_000,
  netAmount: 9_000_000,
  itemCount: 3,
  periodStart: '2026-09-01T00:00:00.000Z',
  periodEnd: '2026-09-20T00:00:00.000Z',
  note: null,
  paymentReference: null,
  paidAt: null,
  createdAt: '2026-09-21T00:00:00.000Z',
};

describe('SettlementActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks the batch paid with the bank reference and note', async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    patch.mockResolvedValue({ ...settlement, status: 'PAID', paymentReference: 'TRX-123' });
    render(<SettlementActions settlement={settlement} onChanged={onChanged} />);

    await user.type(screen.getByLabelText(copy.paymentReference), 'TRX-123');
    await user.type(screen.getByLabelText(copy.paymentNote), 'واریز شد');
    await user.click(screen.getByRole('button', { name: copy.markPaid }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/admin/settlements/st1', {
        status: 'PAID',
        paymentReference: 'TRX-123',
        note: 'واریز شد',
      }),
    );
    expect(await screen.findByText(copy.paid)).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ status: 'PAID' }));
    expect(refresh).toHaveBeenCalled();
  });

  it('requires a payment reference before calling the API', async () => {
    const user = userEvent.setup();
    render(<SettlementActions settlement={settlement} />);

    await user.click(screen.getByRole('button', { name: copy.markPaid }));

    expect(await screen.findByText(adminFa.validation.required)).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
  });

  it('cancels the batch only after confirmation', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    patch.mockResolvedValue({ ...settlement, status: 'CANCELLED' });
    render(<SettlementActions settlement={settlement} />);

    await user.click(screen.getByRole('button', { name: copy.cancel }));
    expect(confirm).toHaveBeenCalledWith(copy.cancelConfirm);
    expect(patch).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: copy.cancel }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/admin/settlements/st1', { status: 'CANCELLED' }),
    );
    expect(await screen.findByText(copy.cancelled)).toBeInTheDocument();
  });

  it('shows the API error and renders nothing for finalized batches', async () => {
    const user = userEvent.setup();
    patch.mockRejectedValue(new ApiError(422, 'SETTLEMENT_NOT_PENDING', 'x'));
    render(<SettlementActions settlement={settlement} />);

    await user.type(screen.getByLabelText(copy.paymentReference), 'TRX-1');
    await user.click(screen.getByRole('button', { name: copy.markPaid }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      adminFa.errors['SETTLEMENT_NOT_PENDING']!,
    );

    const { container } = render(
      <SettlementActions settlement={{ ...settlement, status: 'PAID' }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
