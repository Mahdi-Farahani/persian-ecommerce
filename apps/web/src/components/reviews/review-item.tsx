import { formatJalaliDate, type ReviewView } from '@pe/shared';
import type { ReactNode } from 'react';
import { Badge } from '@/components/admin/badge';
import { t } from '@/i18n';
import { RatingStars } from './rating-stars';

interface ReviewItemProps {
  review: Pick<
    ReviewView,
    'rating' | 'title' | 'body' | 'author' | 'isVerifiedPurchase' | 'isMine' | 'createdAt'
  >;
  /** Rendered at the end of the header row (status badges, actions…). */
  aside?: ReactNode;
}

/** One review as shown in the product page list and the "my reviews" page. */
export function ReviewItem({ review, aside }: ReviewItemProps) {
  return (
    <article className="flex flex-col gap-2 py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
        <RatingStars value={review.rating} />
        <span className="font-medium text-ink">{review.author.name}</span>
        {review.isVerifiedPurchase ? (
          <Badge tone="success">{t.reviews.verifiedPurchase}</Badge>
        ) : null}
        {review.isMine ? <Badge tone="info">{t.reviews.mine}</Badge> : null}
        <time dateTime={review.createdAt}>{formatJalaliDate(review.createdAt)}</time>
        {aside ? <span className="ms-auto flex items-center gap-2">{aside}</span> : null}
      </div>
      <h3 className="text-sm font-bold">{review.title}</h3>
      <p className="text-sm leading-7 whitespace-pre-line text-ink">{review.body}</p>
    </article>
  );
}
