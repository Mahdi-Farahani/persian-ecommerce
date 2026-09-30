import type { ProductCard } from './catalog.js';

/** Reviews, ratings and wishlist contracts. */

export const ReviewStatuses = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ReviewStatus = (typeof ReviewStatuses)[number];

export const REVIEW_MIN_RATING = 1;
export const REVIEW_MAX_RATING = 5;
export const REVIEW_TITLE_MAX = 120;
export const REVIEW_BODY_MAX = 2000;

export interface ReviewAuthor {
  /** Display name derived from the profile, never the email. */
  name: string;
}

/** A review as shown on the product page (approved) or to its author. */
export interface ReviewView {
  id: string;
  productId: string;
  rating: number;
  title: string;
  body: string;
  status: ReviewStatus;
  isVerifiedPurchase: boolean;
  author: ReviewAuthor;
  /** True for the requesting user's own review. */
  isMine: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewSummary {
  productId: string;
  ratingAverage: number;
  ratingCount: number;
  /** Count of approved reviews per star, index 0 = 1 star. */
  distribution: [number, number, number, number, number];
}

/** What the current user may do on a product's review section. */
export interface ReviewEligibility {
  canReview: boolean;
  /** Set when the user already has a review (any status). */
  existingReviewId: string | null;
  hasPurchased: boolean;
  reason: 'NOT_AUTHENTICATED' | 'ALREADY_REVIEWED' | null;
}

export interface ProductReviewsPage {
  summary: ReviewSummary;
  eligibility: ReviewEligibility;
  /** The requesting user's own review (any status), if one exists. */
  mine: ReviewView | null;
}

export interface MyReviewView extends ReviewView {
  product: { id: string; title: string; slug: string; imageUrl: string | null };
  moderationNote: string | null;
}

export interface AdminReviewView extends ReviewView {
  product: { id: string; title: string; slug: string };
  customer: { id: string; email: string | null; phone: string | null; name: string };
  moderationNote: string | null;
  moderatedAt: string | null;
}

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  PENDING: 'در انتظار بررسی',
  APPROVED: 'تأییدشده',
  REJECTED: 'ردشده',
};

export interface WishlistItemView {
  productId: string;
  addedAt: string;
  product: ProductCard;
}

export interface WishlistView {
  items: WishlistItemView[];
  count: number;
}

export const WISHLIST_MAX_ITEMS = 200;
