import type { ReviewView } from '@pe/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { ApiError } from '@/lib/api/errors';
import { ReviewForm } from './review-form';

const api = { post: vi.fn(), patch: vi.fn() };
vi.mock('@/lib/api/client', () => ({
  browserApi: {
    post: (...args: unknown[]) => api.post(...args),
    patch: (...args: unknown[]) => api.patch(...args),
  },
}));

const copy = t.reviews.form;

const saved: ReviewView = {
  id: 'r1',
  productId: 'p1',
  rating: 4,
  title: 'کیفیت عالی',
  body: 'بسته‌بندی خوب بود و سریع رسید.',
  status: 'PENDING',
  isVerifiedPurchase: true,
  author: { name: 'سارا' },
  isMine: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('ReviewForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates the rating, title and body before submitting', async () => {
    const user = userEvent.setup();
    render(<ReviewForm productId="p1" onSaved={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: copy.submit }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.map((alert) => alert.textContent)).toEqual([
      t.validation.rating,
      t.validation.required,
      t.validation.required,
    ]);
    expect(api.post).not.toHaveBeenCalled();

    await user.click(screen.getByRole('radio', { name: t.reviews.stars('۴') }));
    await user.type(screen.getByLabelText(copy.title), 'خب');
    await user.type(screen.getByLabelText(copy.body), 'کوتاه');
    await user.click(screen.getByRole('button', { name: copy.submit }));

    expect(await screen.findByText(t.validation.minLength(3))).toBeInTheDocument();
    expect(screen.getByText(t.validation.minLength(10))).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('posts a new review with a numeric rating and reports it back', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    api.post.mockResolvedValue(saved);
    render(<ReviewForm productId="p1" onSaved={onSaved} />);

    await user.click(screen.getByRole('radio', { name: t.reviews.stars('۴') }));
    await user.type(screen.getByLabelText(copy.title), ' کیفیت عالی ');
    await user.type(screen.getByLabelText(copy.body), 'بسته‌بندی خوب بود و سریع رسید.');
    await user.click(screen.getByRole('button', { name: copy.submit }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/products/p1/reviews', {
        rating: 4,
        title: 'کیفیت عالی',
        body: 'بسته‌بندی خوب بود و سریع رسید.',
      }),
    );
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  it('patches an existing review and surfaces API errors', async () => {
    const user = userEvent.setup();
    api.patch.mockRejectedValue(new ApiError(404, 'REVIEW_NOT_FOUND', 'x'));
    render(<ReviewForm productId="p1" review={saved} onSaved={vi.fn()} />);

    expect(screen.getByRole('radio', { name: t.reviews.stars('۴') })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: t.reviews.stars('۵') }));
    await user.click(screen.getByRole('button', { name: copy.update }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/reviews/r1', {
        rating: 5,
        title: saved.title,
        body: saved.body,
      }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(t.auth.errors['REVIEW_NOT_FOUND']!);
  });
});
