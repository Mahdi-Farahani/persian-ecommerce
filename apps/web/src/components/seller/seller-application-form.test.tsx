import type { SellerProfileView } from '@pe/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { ApiError } from '@/lib/api/errors';
import { SellerApplicationForm } from './seller-application-form';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
}));

const api = { post: vi.fn(), patch: vi.fn() };
vi.mock('@/lib/api/client', () => ({
  browserApi: {
    post: (...args: unknown[]) => api.post(...args),
    patch: (...args: unknown[]) => api.patch(...args),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const copy = t.seller.apply;

const profile: SellerProfileView = {
  id: 'seller-1',
  storeName: 'فروشگاه نمونه',
  slug: 'sample-store',
  description: 'توضیح',
  status: 'PENDING',
  commissionBps: 1000,
  contactPhone: '09121234567',
  contactEmail: 'shop@example.com',
  legalName: null,
  nationalId: null,
  ibanMasked: 'IR06••••••••••••••••••0001',
  province: 'تهران',
  city: 'تهران',
  addressLine: null,
  rejectionReason: null,
  approvedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('SellerApplicationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates required fields and formats before submitting', async () => {
    const user = userEvent.setup();
    render(<SellerApplicationForm />);
    await user.click(screen.getByRole('button', { name: copy.submit }));
    expect(await screen.findAllByRole('alert')).toHaveLength(2);
    expect(api.post).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(copy.fields.storeName), 'ab');
    await user.type(screen.getByLabelText(copy.fields.contactPhone), '۰۹۱۲');
    await user.type(screen.getByLabelText(/کد ملی/), '۱۲۳');
    await user.type(screen.getByLabelText(/شماره شبا/), 'IR12');
    await user.click(screen.getByRole('button', { name: copy.submit }));
    expect(await screen.findByText(t.seller.validation.storeName)).toBeInTheDocument();
    expect(screen.getByText(t.validation.mobile)).toBeInTheDocument();
    expect(screen.getByText(t.seller.validation.nationalId)).toBeInTheDocument();
    expect(screen.getByText(t.seller.validation.iban)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('normalises Persian digits and omits blank optional fields in the apply payload', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    api.post.mockResolvedValue(profile);
    render(<SellerApplicationForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(copy.fields.storeName), '  فروشگاه نمونه ');
    await user.type(screen.getByLabelText(copy.fields.contactPhone), '۰۹۱۲۱۲۳۴۵۶۷');
    await user.type(screen.getByLabelText(/ایمیل/), 'Shop@Example.com');
    await user.type(screen.getByLabelText(/شماره شبا/), 'ir06 2960 0000 0010 0324 2000 01');
    await user.click(screen.getByRole('button', { name: copy.submit }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post).toHaveBeenCalledWith('/seller/apply', {
      storeName: 'فروشگاه نمونه',
      contactPhone: '09121234567',
      contactEmail: 'shop@example.com',
      iban: 'IR062960000000100324200001',
    });
    expect(await screen.findByText(copy.success)).toBeInTheDocument();
    expect(onSuccess).toHaveBeenCalledWith(profile);
    expect(refresh).toHaveBeenCalled();
  });

  it('patches the profile in edit mode, clearing blanks but keeping the stored IBAN', async () => {
    const user = userEvent.setup();
    api.patch.mockResolvedValue({ ...profile, description: null });
    render(<SellerApplicationForm profile={profile} />);

    expect(screen.getByLabelText(copy.fields.storeName)).toHaveValue(profile.storeName);
    expect(screen.getByText(copy.hints.ibanKeep(profile.ibanMasked ?? ''))).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/معرفی فروشگاه/));
    await user.click(screen.getByRole('button', { name: t.common.save }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    expect(api.patch).toHaveBeenCalledWith('/seller/profile', {
      storeName: profile.storeName,
      contactPhone: profile.contactPhone,
      description: null,
      contactEmail: profile.contactEmail,
      legalName: null,
      nationalId: null,
      province: 'تهران',
      city: 'تهران',
      addressLine: null,
    });
    expect(await screen.findByText(copy.saved)).toBeInTheDocument();
  });

  it('shows marketplace error codes in Persian', async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue(new ApiError(409, 'STORE_NAME_TAKEN', 'taken'));
    render(<SellerApplicationForm />);
    await user.type(screen.getByLabelText(copy.fields.storeName), 'فروشگاه تکراری');
    await user.type(screen.getByLabelText(copy.fields.contactPhone), '09121234567');
    await user.click(screen.getByRole('button', { name: copy.submit }));
    expect(await screen.findByText(t.seller.errors['STORE_NAME_TAKEN'] ?? '')).toBeInTheDocument();
  });
});
