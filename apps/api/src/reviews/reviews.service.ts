import { Injectable, Logger } from '@nestjs/common';
import {
  buildPagination,
  PUBLIC_PRODUCT_STATUSES,
  type AdminReviewView,
  type MyReviewView,
  type Paginated,
  type ProductReviewsPage,
  type ReviewEligibility,
  type ReviewSummary,
  type ReviewView,
} from '@pe/shared';
import {
  ConflictAppException,
  NotFoundAppException,
  UnprocessableAppException,
} from '../common/errors/app.exception.js';
import { Prisma, type Review, type ReviewStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AdminReviewsQueryDto,
  CreateReviewDto,
  ModerateReviewDto,
  ProductReviewsQueryDto,
  UpdateReviewDto,
} from './dto/review.dto.js';

/** Order statuses that count as a completed purchase for the verified badge. */
const PURCHASED_STATUSES = [
  'PAID',
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
  'RETURN_REQUESTED',
] as const;

const authorSelect = { select: { firstName: true, lastName: true } } as const;
const reviewInclude = { user: authorSelect } satisfies Prisma.ReviewInclude;
type ReviewRow = Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>;

const adminInclude = {
  user: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
  product: { select: { id: true, title: true, slug: true } },
} satisfies Prisma.ReviewInclude;
type AdminRow = Prisma.ReviewGetPayload<{ include: typeof adminInclude }>;

const myInclude = {
  user: authorSelect,
  product: {
    select: {
      id: true,
      title: true,
      slug: true,
      images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 },
    },
  },
} satisfies Prisma.ReviewInclude;
type MyRow = Prisma.ReviewGetPayload<{ include: typeof myInclude }>;

function authorName(user: { firstName: string | null; lastName: string | null }): string {
  const first = user.firstName?.trim() ?? '';
  const last = user.lastName?.trim() ?? '';
  // Privacy: first name plus the initial of the family name.
  const initial = last ? ` ${last.charAt(0)}.` : '';
  return `${first}${initial}`.trim() || 'کاربر بازارچه';
}

function toView(row: ReviewRow, viewerId: string | null): ReviewView {
  return {
    id: row.id,
    productId: row.productId,
    rating: row.rating,
    title: row.title,
    body: row.body,
    status: row.status,
    isVerifiedPurchase: row.isVerifiedPurchase,
    author: { name: authorName(row.user) },
    isMine: viewerId !== null && row.userId === viewerId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Customer reviews with moderation. Product rating fields are denormalised
 * from APPROVED reviews and recomputed on every status change.
 */
@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // --- public product page ---------------------------------------------------------

  async listForProduct(
    productId: string,
    query: ProductReviewsQueryDto,
    viewerId: string | null,
  ): Promise<Paginated<ReviewView>> {
    await this.requirePublicProduct(productId);
    const where: Prisma.ReviewWhereInput = { productId, status: 'APPROVED' };
    const orderBy: Prisma.ReviewOrderByWithRelationInput[] =
      query.sort === 'highest'
        ? [{ rating: 'desc' }, { createdAt: 'desc' }]
        : query.sort === 'lowest'
          ? [{ rating: 'asc' }, { createdAt: 'desc' }]
          : [{ createdAt: 'desc' }];
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        include: reviewInclude,
        orderBy,
        skip: query.skip,
        take: query.limit,
      }),
    ]);
    return {
      items: rows.map((r) => toView(r, viewerId)),
      pagination: buildPagination(query.page, query.limit, total),
    };
  }

  async pageFor(productId: string, viewerId: string | null): Promise<ProductReviewsPage> {
    await this.requirePublicProduct(productId);
    const [summary, mineRow, hasPurchased] = await Promise.all([
      this.summary(productId),
      viewerId
        ? this.prisma.review.findUnique({
            where: { productId_userId: { productId, userId: viewerId } },
            include: reviewInclude,
          })
        : Promise.resolve(null),
      viewerId ? this.hasPurchased(viewerId, productId) : Promise.resolve(false),
    ]);
    const eligibility: ReviewEligibility = {
      canReview: Boolean(viewerId) && !mineRow,
      existingReviewId: mineRow?.id ?? null,
      hasPurchased,
      reason: !viewerId ? 'NOT_AUTHENTICATED' : mineRow ? 'ALREADY_REVIEWED' : null,
    };
    return { summary, eligibility, mine: mineRow ? toView(mineRow, viewerId) : null };
  }

  async summary(productId: string): Promise<ReviewSummary> {
    const groups = await this.prisma.review.groupBy({
      by: ['rating'],
      where: { productId, status: 'APPROVED' },
      _count: { _all: true },
    });
    const distribution: ReviewSummary['distribution'] = [0, 0, 0, 0, 0];
    let count = 0;
    let sum = 0;
    for (const g of groups) {
      const stars = Math.min(5, Math.max(1, g.rating));
      distribution[stars - 1] = g._count._all;
      count += g._count._all;
      sum += stars * g._count._all;
    }
    return {
      productId,
      ratingAverage: count === 0 ? 0 : Math.round((sum / count) * 10) / 10,
      ratingCount: count,
      distribution,
    };
  }

  // --- customer -------------------------------------------------------------------

  async create(userId: string, productId: string, dto: CreateReviewDto): Promise<ReviewView> {
    await this.requirePublicProduct(productId);
    const existing = await this.prisma.review.findUnique({
      where: { productId_userId: { productId, userId } },
    });
    if (existing) {
      throw new ConflictAppException(
        'REVIEW_ALREADY_EXISTS',
        'شما قبلاً برای این محصول نظر ثبت کرده‌اید؛ می‌توانید آن را ویرایش کنید',
        { reviewId: existing.id },
      );
    }
    const isVerifiedPurchase = await this.hasPurchased(userId, productId);
    try {
      const row = await this.prisma.review.create({
        data: {
          productId,
          userId,
          rating: dto.rating,
          title: dto.title,
          body: dto.body,
          isVerifiedPurchase,
          status: 'PENDING',
        },
        include: reviewInclude,
      });
      this.logger.log({ message: 'review submitted', reviewId: row.id, productId, userId });
      return toView(row, userId);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictAppException(
          'REVIEW_ALREADY_EXISTS',
          'شما قبلاً برای این محصول نظر ثبت کرده‌اید',
        );
      }
      throw error;
    }
  }

  /** Editing sends the review back to moderation. */
  async update(userId: string, reviewId: string, dto: UpdateReviewDto): Promise<ReviewView> {
    const current = await this.requireOwned(userId, reviewId);
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.review.update({
        where: { id: reviewId },
        data: {
          rating: dto.rating ?? current.rating,
          title: dto.title ?? current.title,
          body: dto.body ?? current.body,
          status: 'PENDING',
          moderationNote: null,
          moderatedAt: null,
          moderatedById: null,
        },
        include: reviewInclude,
      });
      if (current.status === 'APPROVED') await this.recalculate(tx, current.productId);
      return updated;
    });
    return toView(row, userId);
  }

  async remove(userId: string, reviewId: string): Promise<void> {
    const current = await this.requireOwned(userId, reviewId);
    await this.prisma.$transaction(async (tx) => {
      await tx.review.delete({ where: { id: reviewId } });
      if (current.status === 'APPROVED') await this.recalculate(tx, current.productId);
    });
  }

  async listMine(userId: string, page: number, limit: number): Promise<Paginated<MyReviewView>> {
    const where: Prisma.ReviewWhereInput = { userId };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        include: myInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      items: rows.map((r) => this.toMine(r, userId)),
      pagination: buildPagination(page, limit, total),
    };
  }

  // --- moderation -------------------------------------------------------------------

  async adminList(query: AdminReviewsQueryDto): Promise<Paginated<AdminReviewView>> {
    const where: Prisma.ReviewWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.productId) where.productId = query.productId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { body: { contains: query.search } },
        { product: { title: { contains: query.search } } },
        { user: { email: { contains: query.search } } },
      ];
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        include: adminInclude,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: query.skip,
        take: query.limit,
      }),
    ]);
    return {
      items: rows.map(toAdminView),
      pagination: buildPagination(query.page, query.limit, total),
    };
  }

  async adminGet(reviewId: string): Promise<AdminReviewView> {
    const row = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: adminInclude,
    });
    if (!row) throw new NotFoundAppException('REVIEW_NOT_FOUND', 'نظر پیدا نشد');
    return toAdminView(row);
  }

  async moderate(
    reviewId: string,
    dto: ModerateReviewDto,
    actorId: string,
  ): Promise<AdminReviewView> {
    const current = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!current) throw new NotFoundAppException('REVIEW_NOT_FOUND', 'نظر پیدا نشد');
    if (current.status === dto.status) {
      throw new UnprocessableAppException('REVIEW_STATUS_UNCHANGED', 'نظر از قبل در این وضعیت است');
    }
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.review.update({
        where: { id: reviewId },
        data: {
          status: dto.status,
          moderationNote: dto.note ?? null,
          moderatedById: actorId,
          moderatedAt: new Date(),
        },
        include: adminInclude,
      });
      await this.recalculate(tx, current.productId);
      return updated;
    });
    return toAdminView(row);
  }

  // --- internals ----------------------------------------------------------------------

  /** Recomputes the denormalised product rating from APPROVED reviews. */
  async recalculate(tx: Prisma.TransactionClient, productId: string): Promise<void> {
    const agg = await tx.review.aggregate({
      where: { productId, status: 'APPROVED' },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await tx.product.update({
      where: { id: productId },
      data: {
        ratingAverage: new Prisma.Decimal(Math.round((agg._avg.rating ?? 0) * 100) / 100),
        ratingCount: agg._count._all,
      },
    });
  }

  private async hasPurchased(userId: string, productId: string): Promise<boolean> {
    const item = await this.prisma.orderItem.findFirst({
      where: { productId, order: { userId, status: { in: [...PURCHASED_STATUSES] } } },
      select: { id: true },
    });
    return Boolean(item);
  }

  private async requirePublicProduct(productId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: { in: [...PUBLIC_PRODUCT_STATUSES] } },
      select: { id: true },
    });
    if (!product) throw new NotFoundAppException('PRODUCT_NOT_FOUND', 'محصول پیدا نشد');
  }

  private async requireOwned(userId: string, reviewId: string): Promise<Review> {
    const row = await this.prisma.review.findFirst({ where: { id: reviewId, userId } });
    if (!row) throw new NotFoundAppException('REVIEW_NOT_FOUND', 'نظر پیدا نشد');
    return row;
  }

  private toMine(row: MyRow, userId: string): MyReviewView {
    return {
      ...toView(row, userId),
      product: {
        id: row.product.id,
        title: row.product.title,
        slug: row.product.slug,
        imageUrl: row.product.images[0]?.url ?? null,
      },
      moderationNote: row.status === 'REJECTED' ? row.moderationNote : null,
    };
  }
}

function toAdminView(row: AdminRow): AdminReviewView {
  const user = row.user;
  return {
    ...toView({ ...row, user: { firstName: user.firstName, lastName: user.lastName } }, null),
    product: row.product,
    customer: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name:
        [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || user.phone || '',
    },
    moderationNote: row.moderationNote,
    moderatedAt: row.moderatedAt?.toISOString() ?? null,
  };
}

export type { ReviewStatus };
