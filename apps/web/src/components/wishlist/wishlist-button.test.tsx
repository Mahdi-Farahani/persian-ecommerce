import type { AuthUser } from '@pe/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/toast';
import { t } from '@/i18n';
import { ApiError } from '@/lib/api/errors';
import { useAuthStore } from '@/store/auth-store';
import { useWishlistStore } from '@/store/wishlist-store';
import { WishlistButton } from './wishlist-button';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/products/anker-charger',
}));

const api = { get: vi.fn(), post: vi.fn(), delete: vi.fn() };
vi.mock('@/lib/api/client', () => ({
  browserApi: {
    get: (...args: unknown[]) => api.get(...args),
    post: (...args: unknown[]) => api.post(...args),
    delete: (...args: unknown[]) => api.delete(...args),
  },
}));

const user: AuthUser = {
  id: 'u1',
  email: 'a@b.co',
  phone: null,
  firstName: 'سارا',
  lastName: 'احمدی',
  status: 'ACTIVE',
  emailVerified: false,
  phoneVerified: false,
  roles: ['CUSTOMER'],
  permissions: [],
  createdAt: '',
};

function renderButton() {
  return render(
    <ToastProvider>
      <WishlistButton productId="p1" />
    </ToastProvider>,
  );
}

describe('WishlistButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWishlistStore.setState({ ids: [], loaded: false, loading: false });
  });

  it('sends guests to the login page with a return path and never calls the API', async () => {
    useAuthStore.setState({ user: null, hydrated: true });
    const actor = userEvent.setup();
    renderButton();

    const button = screen.getByRole('button', { name: t.wishlist.add });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await actor.click(button);

    expect(push).toHaveBeenCalledWith('/login?next=%2Fproducts%2Fanker-charger');
    expect(await screen.findByRole('status')).toHaveTextContent(t.wishlist.loginRequired);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('toggles through the store for signed-in users', async () => {
    useAuthStore.setState({ user, hydrated: true });
    api.post.mockResolvedValue({
      items: [{ productId: 'p1', addedAt: '', product: {} }],
      count: 1,
    });
    api.delete.mockResolvedValue({ items: [], count: 0 });
    const actor = userEvent.setup();
    renderButton();

    await actor.click(screen.getByRole('button', { name: t.wishlist.add }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/wishlist/p1', {}));
    expect(screen.getByRole('button', { name: t.wishlist.remove })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(useWishlistStore.getState().ids).toEqual(['p1']);
    expect(push).not.toHaveBeenCalled();

    await actor.click(screen.getByRole('button', { name: t.wishlist.remove }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/wishlist/p1'));
    expect(screen.getByRole('button', { name: t.wishlist.add })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('rolls back the optimistic update when the API rejects', async () => {
    useAuthStore.setState({ user, hydrated: true });
    api.post.mockRejectedValue(new ApiError(422, 'WISHLIST_FULL', 'x'));
    const actor = userEvent.setup();
    renderButton();

    await actor.click(screen.getByRole('button', { name: t.wishlist.add }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(useWishlistStore.getState().ids).toEqual([]));
    expect(screen.getByRole('button', { name: t.wishlist.add })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(await screen.findByRole('status')).toHaveTextContent(t.auth.errors['WISHLIST_FULL']!);
  });
});
