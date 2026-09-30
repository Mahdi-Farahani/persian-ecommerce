import type { Metadata } from 'next';
import { MyReviewsList } from '@/components/reviews/my-reviews-list';
import { Pagination } from '@/components/ui/pagination';
import { t } from '@/i18n';
import { pageHref, parsePage } from '@/lib/admin/server';
import { requireUser } from '@/lib/auth/server';
import { listMyReviews } from '@/lib/reviews/server';
import { REVIEWS_PAGE_SIZE } from '@/lib/reviews/sorting';

export const metadata: Metadata = { title: t.reviews.myTitle, robots: { index: false } };

export default async function AccountReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  await requireUser(page > 1 ? `/account/reviews?page=${page}` : '/account/reviews');
  const result = await listMyReviews(page, REVIEWS_PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t.reviews.myTitle}</h1>
      <MyReviewsList key={page} initialItems={result.items} />
      <Pagination pagination={result.pagination} hrefFor={pageHref('/account/reviews', {})} />
    </div>
  );
}
