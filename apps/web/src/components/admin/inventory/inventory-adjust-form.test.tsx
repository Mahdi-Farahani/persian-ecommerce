import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminFa } from '@/i18n/admin-fa';
import { ApiError } from '@/lib/api/errors';
import { InventoryAdjustForm } from './inventory-adjust-form';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
}));

const patch = vi.fn();
vi.mock('@/lib/api/client', () => ({
  browserApi: {
    patch: (...args: unknown[]) => patch(...args),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const copy = adminFa.products.inventory;

const snapshot = {
  variantId: 'v1',
  stockQuantity: 7,
  reservedQuantity: 0,
  availableQuantity: 7,
  lowStockThreshold: 2,
  lowStock: false,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('InventoryAdjustForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits a signed quantity (Persian digits accepted) and refreshes', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    patch.mockResolvedValue(snapshot);
    render(<InventoryAdjustForm variantId="v1" onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(copy.quantity), '-۳');
    await user.selectOptions(screen.getByLabelText(copy.type), 'RETURN');
    await user.type(screen.getByLabelText(copy.note, { exact: false }), 'شکسته');
    await user.click(screen.getByRole('button', { name: copy.submit }));

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(patch).toHaveBeenCalledWith('/admin/inventory/v1/adjust', {
      quantity: -3,
      type: 'RETURN',
      note: 'شکسته',
    });
    expect(await screen.findByText(copy.adjusted)).toBeInTheDocument();
    expect(onSuccess).toHaveBeenCalledWith(snapshot);
    expect(refresh).toHaveBeenCalled();
  });

  it('rejects zero before calling the API', async () => {
    const user = userEvent.setup();
    render(<InventoryAdjustForm variantId="v1" />);
    await user.type(screen.getByLabelText(copy.quantity), '0');
    await user.click(screen.getByRole('button', { name: copy.submit }));
    expect(await screen.findByText(adminFa.validation.nonZero)).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
  });

  it('shows the API error message when the adjustment is refused', async () => {
    const user = userEvent.setup();
    patch.mockRejectedValue(new ApiError(422, 'INVENTORY_BELOW_RESERVED', 'x'));
    render(<InventoryAdjustForm variantId="v1" />);
    await user.type(screen.getByLabelText(copy.quantity), '-50');
    await user.click(screen.getByRole('button', { name: copy.submit }));
    expect(
      await screen.findByText(adminFa.errors['INVENTORY_BELOW_RESERVED']!),
    ).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
