import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { adminFa } from '@/i18n/admin-fa';
import { ApiError } from '@/lib/api/errors';
import type { AdminCoupon } from '@/lib/admin/types';
import { CouponForm } from './coupon-form';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh }),
}));

const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();
vi.mock('@/lib/api/client', () => ({
  browserApi: {
    post: (...args: unknown[]) => post(...args),
    patch: (...args: unknown[]) => patch(...args),
    delete: (...args: unknown[]) => del(...args),
    get: vi.fn(),
    put: vi.fn(),
  },
}));

const copy = adminFa.coupons;

const fixedCoupon: AdminCoupon = {
  id: 'c1',
  code: 'SUMMER-50',
  description: 'تخفیف تابستانه',
  type: 'FIXED',
  value: 500_000, // IRR => 50,000 Toman
  maxDiscountAmount: null,
  minCartAmount: 2_000_000, // IRR => 200,000 Toman
  startsAt: null,
  endsAt: null,
  usageLimit: 100,
  usageLimitPerUser: 1,
  usedCount: 7,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('CouponForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a percentage coupon and converts the Toman cap to IRR', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ ...fixedCoupon, id: 'new' });
    render(<CouponForm />);

    await user.type(screen.getByLabelText(copy.fields.code), 'welcome10');
    await user.type(screen.getByLabelText(copy.fields.percent), '۱۰');
    await user.type(
      screen.getByLabelText(copy.fields.maxDiscountAmount, { exact: false }),
      '50,000',
    );
    await user.type(screen.getByLabelText(copy.fields.minCartAmount, { exact: false }), '200000');
    await user.type(screen.getByLabelText(copy.fields.usageLimit, { exact: false }), '100');
    await user.click(screen.getByRole('button', { name: adminFa.common.create }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith('/admin/coupons', {
      code: 'WELCOME10',
      description: undefined,
      type: 'PERCENTAGE',
      value: 10,
      maxDiscountAmount: 500_000,
      minCartAmount: 2_000_000,
      startsAt: null,
      endsAt: null,
      usageLimit: 100,
      usageLimitPerUser: null,
      isActive: true,
    });
    expect(push).toHaveBeenCalledWith('/admin/coupons/new?created=1');
  });

  it('converts a fixed amount entered in Toman to IRR on submit', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue(fixedCoupon);
    render(<CouponForm />);

    await user.type(screen.getByLabelText(copy.fields.code), 'FLAT');
    await user.selectOptions(screen.getByLabelText(copy.fields.type), 'FIXED');
    await user.type(screen.getByLabelText(copy.fields.fixedAmount), '75000');
    await user.click(screen.getByRole('button', { name: adminFa.common.create }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const body = post.mock.calls[0]?.[1] as { type: string; value: number };
    expect(body.type).toBe('FIXED');
    expect(body.value).toBe(750_000);
  });

  it('shows stored IRR amounts as Toman when editing and patches the coupon', async () => {
    const user = userEvent.setup();
    patch.mockResolvedValue(fixedCoupon);
    render(<CouponForm coupon={fixedCoupon} />);

    expect(screen.getByLabelText(copy.fields.fixedAmount)).toHaveValue('50000');
    expect(screen.getByLabelText(copy.fields.minCartAmount, { exact: false })).toHaveValue(
      '200000',
    );
    await user.click(screen.getByRole('button', { name: t.common.save }));

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(patch).toHaveBeenCalledWith(
      '/admin/coupons/c1',
      expect.objectContaining({ code: 'SUMMER-50', value: 500_000, minCartAmount: 2_000_000 }),
    );
    expect(await screen.findByText(copy.saved)).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it('validates code format, percent range and date order before calling the API', async () => {
    const user = userEvent.setup();
    render(<CouponForm />);

    await user.type(screen.getByLabelText(copy.fields.code), 'bad code!');
    await user.type(screen.getByLabelText(copy.fields.percent), '150');
    await user.type(
      screen.getByLabelText(copy.fields.startsAt, { exact: false }),
      '2026-05-10T10:00',
    );
    await user.type(
      screen.getByLabelText(copy.fields.endsAt, { exact: false }),
      '2026-05-01T10:00',
    );
    await user.click(screen.getByRole('button', { name: adminFa.common.create }));

    expect(await screen.findByText(adminFa.validation.couponCode)).toBeInTheDocument();
    expect(screen.getByText(adminFa.validation.percentRange)).toBeInTheDocument();
    expect(screen.getByText(adminFa.validation.endAfterStart)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('shows the API error when the code is already taken', async () => {
    const user = userEvent.setup();
    post.mockRejectedValue(new ApiError(409, 'COUPON_CODE_TAKEN', 'x'));
    render(<CouponForm />);

    await user.type(screen.getByLabelText(copy.fields.code), 'DUPLICATE');
    await user.type(screen.getByLabelText(copy.fields.percent), '5');
    await user.click(screen.getByRole('button', { name: adminFa.common.create }));

    expect(await screen.findByText(adminFa.errors['COUPON_CODE_TAKEN']!)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('deletes after confirmation and returns to the list', async () => {
    const user = userEvent.setup();
    del.mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<CouponForm coupon={fixedCoupon} />);

    await user.click(screen.getByRole('button', { name: t.common.delete }));

    await waitFor(() => expect(del).toHaveBeenCalledWith('/admin/coupons/c1'));
    expect(push).toHaveBeenCalledWith('/admin/coupons');
  });
});
