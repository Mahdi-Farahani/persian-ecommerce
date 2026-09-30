'use client';

import {
  REVIEW_MAX_RATING,
  formatPersianNumber,
  toPersianDigits,
  type Paginated,
  type ProductReviewsPage,
  type ReviewEligibility,
  type ReviewSummary,
  type ReviewView,
} from '@pe/shared';
import Link from 'next/link';
import { useId, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { t } from '@/i18n';
import { browserApi } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/error-message';
import { REVIEWS_PAGE_SIZE, REVIEW_SORTS, type ReviewSort } from '@/lib/reviews/sorting';
import { RatingStars } from './rating-stars';
import { ReviewForm } from './review-form';
import { ReviewItem } from './review-item';
import { ReviewStatusBadge } from './review-status-badge';

interface ProductReviewsProps {
  productId: string;
  productSlug: string;
  initialPage: ProductReviewsPage;
  initialReviews: Paginated<ReviewView>;
}

type Notice = { tone: 'success' | 'error'; message: string } | null;

const copy = t.reviews;

/**
 * Product page reviews section: rating summary, the viewer's own review (or
 * the form / login prompt) and the paginated list of approved reviews.
 */
export function ProductReviews({
  productId,
  productSlug,
  initialPage,
  initialReviews,
}: ProductReviewsProps) {
  const headingId = useId();
  const [summary] = useState<ReviewSummary>(initialPage.summary);
  const [eligibility, setEligibility] = useState<ReviewEligibility>(initialPage.eligibility);
  const [mine, setMine] = useState<ReviewView | null>(initialPage.mine);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [deleting, setDeleting] = useState(false);

  const [sort, setSort] = useState<ReviewSort>('newest');
  const [items, setItems] = useState<ReviewView[]>(initialReviews.items);
  const [pagination, setPagination] = useState(initialReviews.pagination);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const fetchPage = async (page: number, nextSort: ReviewSort) => {
    setLoading(true);
    setListError(null);
    try {
      const result = await browserApi.get<Paginated<ReviewView>>(
        `/products/${encodeURIComponent(productId)}/reviews`,
        { query: { page, limit: REVIEWS_PAGE_SIZE, sort: nextSort } },
      );
      setItems((current) => (page === 1 ? result.items : [...current, ...result.items]));
      setPagination(result.pagination);
    } catch (error) {
      setListError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const onSortChange = (nextSort: ReviewSort) => {
    setSort(nextSort);
    void fetchPage(1, nextSort);
  };

  const onSaved = (saved: ReviewView) => {
    const wasEdit = mine !== null;
    setMine(saved);
    setEditing(false);
    setEligibility((current) => ({
      ...current,
      canReview: false,
      existingReviewId: saved.id,
      reason: 'ALREADY_REVIEWED',
    }));
    // A review goes back to moderation, so it leaves the approved list until re-approved.
    setItems((current) => current.filter((item) => item.id !== saved.id));
    setNotice({ tone: 'success', message: wasEdit ? copy.updated : copy.submitted });
  };

  const onDelete = async () => {
    if (!mine || !window.confirm(copy.deleteConfirm)) return;
    setDeleting(true);
    setNotice(null);
    try {
      await browserApi.delete(`/reviews/${encodeURIComponent(mine.id)}`);
      setItems((current) => current.filter((item) => item.id !== mine.id));
      setMine(null);
      setEditing(false);
      setEligibility((current) => ({
        ...current,
        canReview: true,
        existingReviewId: null,
        reason: null,
      }));
      setNotice({ tone: 'success', message: copy.deleted });
    } catch (error) {
      setNotice({ tone: 'error', message: errorMessage(error) });
    } finally {
      setDeleting(false);
    }
  };

  const hasMore = pagination.page < pagination.totalPages;
  const loginHref = `/login?next=${encodeURIComponent(`/products/${productSlug}`)}`;

  return (
    <section className="mt-8" aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-3 text-lg font-bold">
        {copy.title}
      </h2>
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <SummaryCard summary={summary} />

        <div className="flex min-w-0 flex-col gap-4">
          {notice ? <Alert tone={notice.tone}>{notice.message}</Alert> : null}

          {eligibility.reason === 'NOT_AUTHENTICATED' ? (
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-muted">{copy.loginPrompt}</p>
              <Link
                href={loginHref}
                className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-bold transition hover:border-brand-400 hover:text-brand-700"
              >
                {copy.login}
              </Link>
            </Card>
          ) : mine ? (
            <Card>
              {editing ? (
                <>
                  <h3 className="mb-4 text-base font-bold">{copy.editReview}</h3>
                  <ReviewForm
                    productId={productId}
                    review={mine}
                    onSaved={onSaved}
                    onCancel={() => setEditing(false)}
                  />
                </>
              ) : (
                <>
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-bold">{copy.mine}</h3>
                    <ReviewStatusBadge status={mine.status} />
                  </div>
                  <ReviewItem review={{ ...mine, isMine: false }} />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                      {copy.editReview}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-accent-600"
                      loading={deleting}
                      onClick={() => void onDelete()}
                    >
                      {copy.deleteReview}
                    </Button>
                  </div>
                </>
              )}
            </Card>
          ) : eligibility.canReview ? (
            <Card>
              <h3 className="mb-4 text-base font-bold">{copy.writeReviewTitle}</h3>
              <ReviewForm productId={productId} onSaved={onSaved} />
            </Card>
          ) : null}

          <div className="rounded-card border border-border bg-surface px-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3">
              <p className="text-sm text-ink-muted">
                {copy.reviewsCount(formatPersianNumber(pagination.total))}
              </p>
              <SortSelect value={sort} onChange={onSortChange} disabled={loading} />
            </div>
            {items.length === 0 && !loading ? (
              <div className="py-10 text-center text-sm text-ink-muted">
                <p>{copy.noReviews}</p>
                {eligibility.canReview ? <p className="mt-1 text-xs">{copy.beFirst}</p> : null}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((review) => (
                  <li key={review.id}>
                    <ReviewItem review={review} />
                  </li>
                ))}
              </ul>
            )}
            {listError ? (
              <div className="py-3">
                <Alert tone="error">{listError}</Alert>
              </div>
            ) : null}
            {hasMore || loading ? (
              <div className="flex justify-center py-3">
                <Button
                  variant="outline"
                  size="sm"
                  loading={loading}
                  onClick={() => void fetchPage(pagination.page + 1, sort)}
                >
                  {loading ? copy.loading : copy.loadMore}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function SummaryCard({ summary }: { summary: ReviewSummary }) {
  const hasRatings = summary.ratingCount > 0;
  const average = hasRatings ? summary.ratingAverage : 0;
  return (
    <Card className="flex flex-col gap-4 self-start">
      <div>
        <p className="text-sm text-ink-muted">{copy.summaryTitle}</p>
        {hasRatings ? (
          <p className="mt-1 flex items-baseline gap-1">
            <span className="text-4xl font-bold tabular-nums">
              {toPersianDigits(average.toFixed(1))}
            </span>
            <span className="text-sm text-ink-muted">
              {copy.outOf(toPersianDigits(REVIEW_MAX_RATING))}
            </span>
          </p>
        ) : (
          <p className="mt-1 text-sm">{copy.noRating}</p>
        )}
        <div className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
          <RatingStars value={average} size="md" />
          <span>{copy.reviewsCount(formatPersianNumber(summary.ratingCount))}</span>
        </div>
      </div>
      <dl aria-label={copy.distribution} className="flex flex-col gap-1.5">
        {summary.distribution
          .map((count, index) => ({ stars: index + 1, count }))
          .reverse()
          .map(({ stars, count }) => {
            const percent = hasRatings ? Math.round((count / summary.ratingCount) * 100) : 0;
            return (
              <div key={stars} className="flex items-center gap-2 text-xs">
                <dt className="w-14 shrink-0 text-ink-muted">
                  {copy.stars(toPersianDigits(stars))}
                </dt>
                <dd className="flex flex-1 items-center gap-2">
                  <span
                    className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted"
                    role="progressbar"
                    aria-valuenow={percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={copy.stars(toPersianDigits(stars))}
                  >
                    <span
                      className="block h-full rounded-full bg-amber-400"
                      style={{ width: `${percent}%` }}
                    />
                  </span>
                  <span className="w-8 text-end tabular-nums text-ink-muted">
                    {formatPersianNumber(count)}
                  </span>
                </dd>
              </div>
            );
          })}
      </dl>
    </Card>
  );
}

function SortSelect({
  value,
  onChange,
  disabled,
}: {
  value: ReviewSort;
  onChange: (sort: ReviewSort) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <span className="text-ink-muted">{copy.sort}:</span>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as ReviewSort)}
        className="h-9 rounded-lg border border-border bg-surface px-2 text-sm"
      >
        {REVIEW_SORTS.map((option) => (
          <option key={option} value={option}>
            {copy.sortOptions[option] ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}
