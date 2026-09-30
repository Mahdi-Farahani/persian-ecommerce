import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminFa } from '@/i18n/admin-fa';
import type { AdminUser } from '@/lib/admin/types';
import { ApiError } from '@/lib/api/errors';
import { UserRolesEditor } from './user-roles-editor';

const patch = vi.fn();
vi.mock('@/lib/api/client', () => ({
  browserApi: { patch: (...args: unknown[]) => patch(...args) },
}));

const user: AdminUser = {
  id: 'u1',
  email: 'a@b.co',
  phone: null,
  firstName: 'علی',
  lastName: 'رضایی',
  status: 'ACTIVE',
  emailVerified: true,
  phoneVerified: false,
  roles: ['CUSTOMER'],
  permissions: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const copy = adminFa.users;

describe('UserRolesEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pre-selects the current roles and refuses an empty selection', async () => {
    const actor = userEvent.setup();
    render(<UserRolesEditor user={user} onSaved={vi.fn()} onCancel={vi.fn()} />);
    const customer = screen.getByLabelText(copy.roles['CUSTOMER']!);
    expect(customer).toBeChecked();
    await actor.click(customer);
    await actor.click(screen.getByRole('button', { name: copy.saveRoles }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.atLeastOneRole);
    expect(patch).not.toHaveBeenCalled();
  });

  it('saves the selected roles', async () => {
    const actor = userEvent.setup();
    const onSaved = vi.fn();
    const updated = { ...user, roles: ['CUSTOMER', 'ADMIN'] };
    patch.mockResolvedValue(updated);
    render(<UserRolesEditor user={user} onSaved={onSaved} onCancel={vi.fn()} />);
    await actor.click(screen.getByLabelText(copy.roles['ADMIN']!));
    await actor.click(screen.getByRole('button', { name: copy.saveRoles }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/admin/users/u1/roles', { roles: ['CUSTOMER', 'ADMIN'] }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(updated));
  });

  it('shows a localized message for self-modification errors', async () => {
    const actor = userEvent.setup();
    patch.mockRejectedValue(new ApiError(403, 'SELF_MODIFICATION', 'x'));
    render(<UserRolesEditor user={user} onSaved={vi.fn()} onCancel={vi.fn()} />);
    await actor.click(screen.getByLabelText(copy.roles['SELLER']!));
    await actor.click(screen.getByRole('button', { name: copy.saveRoles }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      adminFa.errors['SELF_MODIFICATION']!,
    );
  });
});
