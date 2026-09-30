import { formatJalaliDateTime, hasPermission, toPersianDigits } from '@pe/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/admin/badge';
import { Forbidden } from '@/components/admin/forbidden';
import { PageHeader } from '@/components/admin/page-header';
import { ReviewModerationActions } from '@/components/admin/reviews/review-moderation-actions';
import { RatingStars } from '@/components/reviews/rating-stars';
import { ReviewStatusBadge } from '@/components/reviews/review-status-badge';
import { Card, CardTitle } from '@/components/ui/card';
import { adminFa } from '@/i18n/admin-fa';
import { AdminPermissions } from '@/lib/admin/navigation';
import { adminGetReview } from '@/lib/admin/server';
import { requireUser } from '@/lib/auth/server';

export const metadata = { title: adminFa.reviews.detailTitle };

const copy = adminFa.reviews;

export default async function AdminReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/admin/reviews/${id}`);
  if (!hasPermission(user, AdminPermissions.reviewsModerate)) return <Forbidden />;
  const review = await adminGetReview(id);
  if (!review) notFound();

  const facts: Array<{ label: string; value: string; ltr?: boolean }> = [
    { label: copy.customer, value: review.customer.name || adminFa.orders.noName },
  ];
  if (review.customer.email)
    facts.push({ label: copy.email, value: review.customer.email, ltr: true });
  if (review.customer.phone) {
    facts.push({ label: copy.phone, value: toPersianDigits(review.customer.phone), ltr: true });
  }
  facts.push({ label: copy.createdAt, value: formatJalaliDateTime(review.createdAt) });
  if (review.updatedAt !== review.createdAt) {
    facts.push({ label: copy.updatedAt, value: formatJalaliDateTime(review.updatedAt) });
  }
  if (review.moderatedAt) {
    facts.push({ label: copy.moderatedAt, value: formatJalaliDateTime(review.moderatedAt) });
  }
  if (review.moderationNote)
    facts.push({ label: copy.moderationNote, value: review.moderationNote });

  return (
    <div>
      <PageHeader
        title={copy.detailTitle}
        description={formatJalaliDateTime(review.createdAt)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ReviewStatusBadge status={review.status} />
            <Link
              href="/admin/reviews"
              className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-medium hover:border-brand-400 hover:text-brand-700"
            >
              {copy.backToList}
            </Link>
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          <Card>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <RatingStars value={review.rating} size="md" />
              {review.isVerifiedPurchase ? (
                <Badge tone="success">{copy.verified}</Badge>
              ) : (
                <Badge tone="neutral">{copy.notVerified}</Badge>
              )}
            </div>
            <h2 className="text-lg font-bold">{review.title}</h2>
            <p className="mt-3 text-sm leading-8 whitespace-pre-line">{review.body}</p>
          </Card>
          <Card className="text-sm">
            <CardTitle>{copy.product}</CardTitle>
            <p className="font-medium">{review.product.title}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/admin/products/${review.product.id}`}
                className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-medium hover:border-brand-400 hover:text-brand-700"
              >
                {copy.viewProduct}
              </Link>
              <Link
                href={`/products/${review.product.slug}`}
                className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-medium hover:border-brand-400 hover:text-brand-700"
              >
                {copy.viewInStore}
              </Link>
              <Link
                href={`/admin/reviews?productId=${encodeURIComponent(review.product.id)}`}
                className="inline-flex h-9 items-center px-2 text-xs font-medium text-brand-700 hover:underline"
              >
                {copy.productFilter}
              </Link>
            </div>
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardTitle>{adminFa.common.actions}</CardTitle>
            <ReviewModerationActions
              key={review.status}
              reviewId={review.id}
              status={review.status}
            />
          </Card>
          <Card className="text-sm">
            <dl className="grid gap-3">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="text-xs text-ink-muted">{fact.label}</dt>
                  <dd className="font-medium break-words" dir={fact.ltr ? 'ltr' : undefined}>
                    <span className={fact.ltr ? 'inline-block text-start' : undefined}>
                      {fact.value}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </aside>
      </div>
    </div>
  );
}
