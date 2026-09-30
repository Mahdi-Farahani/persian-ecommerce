import type { SellerOrderView } from '@pe/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { ApiError } from '@/lib/api/errors';
import { ShipmentForm } from './shipment-form';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
}));

const post = vi.fn();
vi.mock('@/lib/api/client', () => ({
  browserApi: {
    post: (...args: unknown[]) => post(...args),
    get: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const copy = t.seller.orders.ship;

const shippedOrder = {
  id: 'o1',
  number: 'PE-000001',
  status: 'SHIPPED',
  awaitingShipment: false,
  items: [],
  shipments: [],
} as unknown as SellerOrderView;

describe('ShipmentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits the shipment with normalised digits and hides itself afterwards', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    post.mockResolvedValue(shippedOrder);
    render(<ShipmentForm orderId="o1" onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/شرکت حمل/), 'پست پیشتاز');
    await user.type(screen.getByLabelText(/کد رهگیری/), '۱۲۳۴۵۶');
    await user.click(screen.getByRole('button', { name: copy.submit }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith('/seller/orders/o1/shipments', {
      carrier: 'پست پیشتاز',
      trackingCode: '123456',
    });
    expect(await screen.findByText(copy.done)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.submit })).toBeNull();
    expect(onSuccess).toHaveBeenCalledWith(shippedOrder);
    expect(refresh).toHaveBeenCalled();
  });

  it('keeps the form and shows the error when the API refuses', async () => {
    const user = userEvent.setup();
    post.mockRejectedValue(new ApiError(404, 'ORDER_NOT_FOUND', 'missing'));
    render(<ShipmentForm orderId="o1" />);
    await user.click(screen.getByRole('button', { name: copy.submit }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      t.seller.errors['ORDER_NOT_FOUND'] ?? '',
    );
    expect(screen.getByRole('button', { name: copy.submit })).toBeInTheDocument();
  });
});
