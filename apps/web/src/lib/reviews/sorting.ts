/** Sort orders accepted by `GET /products/:id/reviews` (shared by server and client code). */
export const REVIEW_SORTS = ['newest', 'highest', 'lowest'] as const;
export type ReviewSort = (typeof REVIEW_SORTS)[number];

export const REVIEWS_PAGE_SIZE = 10;
