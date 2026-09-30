import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { useAuthStore } from '@/store/auth-store';
import { HeaderActions } from './header-actions';
import { MobileMenu } from './mobile-menu';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

describe('HeaderActions', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, hydrated: true });
  });

  it('shows the login link for guests and the user menu when signed in', async () => {
    const { rerender } = render(<HeaderActions />);
    expect(screen.getByRole('link', { name: new RegExp(t.nav.login) })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(screen.getByRole('link', { name: t.nav.cart })).toHaveAttribute('href', '/cart');

    useAuthStore.setState({
      user: {
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
      },
    });
    rerender(<HeaderActions />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: t.nav.userMenu }));
    expect(screen.getByRole('menuitem', { name: t.account.profile })).toHaveAttribute(
      'href',
      '/account',
    );
    expect(screen.queryByRole('menuitem', { name: t.nav.admin })).not.toBeInTheDocument();
  });
});

describe('MobileMenu', () => {
  it('opens and closes with keyboard', async () => {
    const user = userEvent.setup();
    render(<MobileMenu items={[{ href: '/products', label: t.nav.products }]} />);
    const toggle = screen.getByRole('button', { name: t.nav.menu });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(screen.getByRole('link', { name: t.nav.products })).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('link', { name: t.nav.products })).not.toBeInTheDocument();
  });
});
