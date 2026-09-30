import {
  ReviewStatuses,
  REVIEW_STATUS_LABELS,
  formatJalaliDateTime,
  formatPersianNumber,
  hasPermission,
  toPersianDigits,
} from '@pe/shared';
import Link from 'next/link';
import { Badge } from '@/components/admin/badge';
import { DataTable, Td } from '@/components/admin/data-table';
import { Forbidden } from '@/components/admin/forbidden';
import { PageHeader } from '@/components/admin/page-header';
import { ReviewModerationActions } from '@/components/admin/reviews/review-moderation-actions';
import { RatingStars } from '@/components/reviews/rating-stars';
import { ReviewStatusBadge } from '@/components/reviews/review-status-badge';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/form-field';
import { Pagination } from '@/components/ui/pagination';
import { adminFa } from '@/i18n/admin-fa';
import { AdminPermissions } from '@/lib/admin/navigation';
import { adminListReviews, pageHref, parsePage } from '@/lib/admin/server';
import { requireUser } from '@/lib/auth/server';

export const metadata = { title: adminFa.reviews.title };

const copy = adminFa.reviews;
const PAGE_SIZE = 20;

const columns = [
  { key: 'product', label: copy.table.product },
  { key: 'customer', label: copy.table.customer },
  { key: 'rating', label: copy.table.rating },
  { key: 'title', label: copy.table.title },
  { key: 'verified', label: copy.table.verified },
  { key: 'status', label: copy.table.status },
  { key: 'date', label: copy.table.date },
  { key: 'actions', label: adminFa.common.actions, srOnly: true },
] as const;

const statusOptions = ReviewStatuses.map((status) => ({
  value: status,
  label: REVIEW_STATUS_LABELS[status],
}));

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string; productId?: string }>;
}) {
  const user = await requireUser('/admin/reviews');
  if (!hasPermission(user, AdminPermissions.reviewsModerate)) return <Forbidden />;

  const params = await searchParams;
  const page = parsePage(params.page);
  const search = params.search?.trim() ?? '';
  const status =
    params.status && (ReviewStatuses as readonly string[]).includes(params.status)
      ? params.status
      : '';
  const productId = params.productId?.trim() ?? '';
  const hasFilters = Boolean(search || status || productId);

  const result = await adminListReviews({ page, limit: PAGE_SIZE, search, status, productId });

  return (
    <div>
      <PageHeader
        title={copy.title}
        description={`${copy.description} ${adminFa.common.total(formatPersianNumber(result.pagination.total))}`}
      />
      <form method="get" action="/admin/reviews" className="mb-4 flex flex-wrap items-end gap-3">
        <TextField
          label={adminFa.common.search}
          name="search"
          defaultValue={search}
          placeholder={copy.searchPlaceholder}
          containerClassName="min-w-56 flex-1"
        />
        <SelectField
          label={adminFa.common.status}
          name="status"
          defaultValue={status}
          placeholder={copy.allStatuses}
          options={statusOptions}
        />
        {productId ? <input type="hidden" name="productId" value={productId} /> : null}
        <Button type="submit" variant="secondary">
          {adminFa.common.filter}
        </Button>
        {hasFilters ? (
          <Link
            href="/admin/reviews"
            className="inline-flex h-11 items-center px-2 text-sm text-ink-muted hover:text-brand-700"
          >
            {adminFa.common.clearFilters}
          </Link>
        ) : null}
      </form>
      {productId ? (
        <p className="mb-3 text-xs text-ink-muted">
          {copy.productFilter}:{' '}
          <span dir="ltr" className="font-mono">
            {productId}
          </span>
        </p>
      ) : null}
      <DataTable
        columns={columns}
        empty={result.items.length === 0}
        emptyMessage={copy.empty}
        caption={copy.title}
      >
        {result.items.map((review) => (
          <tr key={review.id} className="align-top hover:bg-surface-muted/60">
            <Td>
              <Link
                href={`/admin/products/${review.product.id}`}
                className="line-clamp-2 max-w-56 font-medium hover:text-brand-700"
              >
                {review.product.title}
              </Link>
            </Td>
            <Td>
              <div className="flex flex-col">
                <span>{review.customer.name || adminFa.orders.noName}</span>
                <span className="text-xs text-ink-muted" dir="ltr">
                  {review.customer.email ??
                    (review.customer.phone ? toPersianDigits(review.customer.phone) : '')}
                </span>
              </div>
            </Td>
            <Td>
              <RatingStars value={review.rating} />
            </Td>
            <Td>
              <Link
                href={`/admin/reviews/${review.id}`}
                className="line-clamp-2 max-w-64 hover:text-brand-700"
              >
                {review.title}
              </Link>
            </Td>
            <Td>
              {review.isVerifiedPurchase ? (
                <Badge tone="success">{copy.verified}</Badge>
              ) : (
                <span className="text-xs text-ink-muted">{copy.notVerified}</span>
              )}
            </Td>
            <Td>
              <ReviewStatusBadge status={review.status} />
            </Td>
            <Td className="text-xs whitespace-nowrap text-ink-muted">
              {formatJalaliDateTime(review.createdAt)}
            </Td>
            <Td>
              <ReviewModerationActions
                key={review.status}
                reviewId={review.id}
                status={review.status}
                compact
              />
            </Td>
          </tr>
        ))}
      </DataTable>
      <div className="mt-4">
        <Pagination
          pagination={result.pagination}
          hrefFor={pageHref('/admin/reviews', { search, status, productId })}
        />
      </div>
    </div>
  );
}
