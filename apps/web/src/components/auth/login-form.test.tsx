import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { ApiError } from '@/lib/api/errors';
import { useAuthStore } from '@/store/auth-store';
import { LoginForm, sanitizeNextPath } from './login-form';

const push = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, refresh }),
}));

const post = vi.fn();
vi.mock('@/lib/api/client', () => ({
  browserApi: { post: (...args: unknown[]) => post(...args) },
}));

describe('sanitizeNextPath', () => {
  it('only allows same-origin relative paths', () => {
    expect(sanitizeNextPath('/account/addresses')).toBe('/account/addresses');
    expect(sanitizeNextPath('https://evil.example')).toBe('/account');
    expect(sanitizeNextPath('//evil.example')).toBe('/account');
    expect(sanitizeNextPath('/login?next=/x')).toBe('/account');
    expect(sanitizeNextPath(null)).toBe('/account');
  });
});

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: null, hydrated: true });
  });

  it('validates before submitting', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.click(screen.getByRole('button', { name: t.auth.submitLogin }));
    expect(await screen.findAllByRole('alert')).toHaveLength(2);
    expect(post).not.toHaveBeenCalled();
  });

  it('submits credentials, stores the user and redirects', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ user: { id: 'u1', roles: ['CUSTOMER'], permissions: [] } });
    render(<LoginForm nextPath="/checkout" />);
    await user.type(screen.getByLabelText(t.auth.identifier), '09123456789');
    await user.type(screen.getByLabelText(t.auth.password), 'Passw0rd!');
    await user.click(screen.getByRole('button', { name: t.auth.submitLogin }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/auth/login', {
        identifier: '09123456789',
        password: 'Passw0rd!',
      }),
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/checkout'));
    expect(useAuthStore.getState().user?.id).toBe('u1');
  });

  it('shows a localized error for invalid credentials', async () => {
    const user = userEvent.setup();
    post.mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'x'));
    render(<LoginForm />);
    await user.type(screen.getByLabelText(t.auth.identifier), 'a@b.co');
    await user.type(screen.getByLabelText(t.auth.password), 'wrong');
    await user.click(screen.getByRole('button', { name: t.auth.submitLogin }));
    expect(await screen.findByText(t.auth.errors['INVALID_CREDENTIALS']!)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
