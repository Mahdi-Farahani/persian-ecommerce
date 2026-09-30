import 'server-only';
import type { MyReviewView, Paginated, ProductReviewsPage, ReviewView } from '@pe/shared';
import { ApiError } from '@/lib/api/errors';
import { serverApi } from '@/lib/api/server';
import { REVIEWS_PAGE_SIZE, type ReviewSort } from './sorting';

const noStore = { cache: 'no-store' as const };

/**
 * Summary, eligibility and the viewer's own review for a product. Cookies are
 * forwarded so `mine`/`eligibility` are per user. Resolves to null when the
 * reviews feature is unavailable so the product page still renders.
 */
export async function getProductReviewsPage(productId: string): Promise<ProductReviewsPage | null> {
  try {
    return await serverApi<ProductReviewsPage>(
      `/products/${encodeURIComponent(productId)}/reviews/summary`,
      noStore,
    );
  } catch (error) {
    if (error instanceof ApiError && (error.isNotFound || error.status === 0)) return null;
    throw error;
  }
}

/** First page of approved reviews for a product (with `isMine` for the viewer). */
export async function listProductReviews(
  productId: string,
  options: { page?: number; limit?: number; sort?: ReviewSort } = {},
): Promise<Paginated<ReviewView> | null> {
  try {
    return await serverApi<Paginated<ReviewView>>(
      `/products/${encodeURIComponent(productId)}/reviews`,
      {
        query: {
          page: options.page ?? 1,
          limit: options.limit ?? REVIEWS_PAGE_SIZE,
          sort: options.sort ?? 'newest',
        },
        ...noStore,
      },
    );
  } catch (error) {
    if (error instanceof ApiError && (error.isNotFound || error.status === 0)) return null;
    throw error;
  }
}

/** The signed-in user's reviews across all products. */
export function listMyReviews(page: number, limit: number): Promise<Paginated<MyReviewView>> {
  return serverApi<Paginated<MyReviewView>>('/reviews/me', { query: { page, limit }, ...noStore });
}
