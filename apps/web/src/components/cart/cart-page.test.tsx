import type { CartView } from '@pe/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { useAuthStore } from '@/store/auth-store';
import { useCartStore } from '@/store/cart-store';
import { CartPage } from './cart-page';

const api = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() };
vi.mock('@/lib/api/client', () => ({
  browserApi: {
    get: (...args: unknown[]) => api.get(...args),
    post: (...args: unknown[]) => api.post(...args),
    patch: (...args: unknown[]) => api.patch(...args),
    delete: (...args: unknown[]) => api.delete(...args),
  },
}));

function cartWith(quantity: number): CartView {
  return {
    id: 'c1',
    items: [
      {
        id: 'i1',
        variantId: 'v1',
        productId: 'p1',
        productTitle: 'شارژر انکر',
        productSlug: 'anker',
        variantTitle: 'مشکی',
        sku: 'AN-1',
        image: null,
        unitPrice: 18_000_000,
        compareAtPrice: null,
        priceAtAdd: 18_000_000,
        priceChanged: false,
        quantity,
        lineTotal: 18_000_000 * quantity,
        availableQuantity: 5,
        inStock: true,
        quantityExceedsStock: false,
        seller: null,
      },
    ],
    coupon: null,
    totals: {
      subtotal: 18_000_000 * quantity,
      discount: 0,
      total: 18_000_000 * quantity,
      itemCount: quantity,
      currency: 'IRR',
    },
    warnings: [],
    updatedAt: '',
  };
}

describe('CartPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCartStore.setState({ cart: null, loaded: false, loading: false });
    useAuthStore.setState({ user: null, hydrated: true });
  });

  it('renders the empty state', () => {
    render(<CartPage initialCart={null} />);
    expect(screen.getByText(t.cart.empty)).toBeInTheDocument();
  });

  it('updates quantity through the API and shows server totals', async () => {
    const user = userEvent.setup();
    api.patch.mockResolvedValue(cartWith(2));
    render(<CartPage initialCart={cartWith(1)} />);
    expect(screen.getByText('شارژر انکر')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.cart.increase }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/cart/items/i1', { quantity: 2 }));
    await waitFor(() => expect(screen.getAllByText('۳٬۶۰۰٬۰۰۰').length).toBeGreaterThan(0));
    // Guests are sent to login before checkout.
    expect(screen.getByRole('link', { name: t.cart.checkout })).toHaveAttribute(
      'href',
      '/login?next=/checkout',
    );
  });

  it('applies a coupon and surfaces API errors', async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'ApiError' }));
    render(<CartPage initialCart={cartWith(1)} />);
    await user.type(screen.getByLabelText(t.cart.coupon), 'BAD');
    await user.click(screen.getByRole('button', { name: t.cart.applyCoupon }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    api.post.mockResolvedValueOnce({
      ...cartWith(1),
      coupon: {
        code: 'OK10',
        type: 'PERCENTAGE',
        value: 10,
        discount: 1_800_000,
        description: null,
      },
    });
    await user.clear(screen.getByLabelText(t.cart.coupon));
    await user.type(screen.getByLabelText(t.cart.coupon), 'OK10');
    await user.click(screen.getByRole('button', { name: t.cart.applyCoupon }));
    expect(await screen.findByText(t.cart.couponApplied('OK10'))).toBeInTheDocument();
  });
});
