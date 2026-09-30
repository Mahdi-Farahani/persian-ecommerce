import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  AdminReviewView,
  AuthUser,
  MyReviewView,
  Paginated,
  ProductReviewsPage,
  ReviewView,
} from '@pe/shared';
import { AuditService } from '../audit/audit.service.js';
import { CurrentUser, OptionalAuth, RequirePermissions } from '../auth/auth.decorators.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { Permissions } from '../rbac/permissions.js';
import {
  AdminReviewsQueryDto,
  CreateReviewDto,
  ModerateReviewDto,
  ProductReviewsQueryDto,
  UpdateReviewDto,
} from './dto/review.dto.js';
import { ReviewsService } from './reviews.service.js';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('products/:productId/reviews')
  @OptionalAuth()
  @ApiOperation({ summary: 'Approved reviews of a product' })
  list(
    @Param('productId') productId: string,
    @Query() query: ProductReviewsQueryDto,
    @CurrentUser() user: AuthUser | undefined,
  ): Promise<Paginated<ReviewView>> {
    return this.reviews.listForProduct(productId, query, user?.id ?? null);
  }

  @Get('products/:productId/reviews/summary')
  @OptionalAuth()
  @ApiOperation({ summary: 'Rating summary, eligibility of the viewer and their own review' })
  page(
    @Param('productId') productId: string,
    @CurrentUser() user: AuthUser | undefined,
  ): Promise<ProductReviewsPage> {
    return this.reviews.pageFor(productId, user?.id ?? null);
  }

  @Post('products/:productId/reviews')
  @ApiBearerAuth('access-token')
  @ApiCookieAuth('pe_access')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a review (one per product; goes to moderation)' })
  create(
    @Param('productId') productId: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ReviewView> {
    return this.reviews.create(user.id, productId, dto);
  }

  @Get('reviews/me')
  @ApiBearerAuth('access-token')
  @ApiCookieAuth('pe_access')
  @ApiOperation({ summary: 'My reviews with their moderation status' })
  mine(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<MyReviewView>> {
    return this.reviews.listMine(user.id, query.page, query.limit);
  }

  @Patch('reviews/:id')
  @ApiBearerAuth('access-token')
  @ApiCookieAuth('pe_access')
  @ApiOperation({ summary: 'Edit my review (returns to moderation)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ReviewView> {
    return this.reviews.update(user.id, id, dto);
  }

  @Delete('reviews/:id')
  @ApiBearerAuth('access-token')
  @ApiCookieAuth('pe_access')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete my review' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser): Promise<void> {
    return this.reviews.remove(user.id, id);
  }
}

@ApiTags('admin/reviews')
@ApiBearerAuth('access-token')
@ApiCookieAuth('pe_access')
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions(Permissions.ReviewsModerate)
  @ApiOperation({ summary: 'Moderation queue (pending first)' })
  list(@Query() query: AdminReviewsQueryDto): Promise<Paginated<AdminReviewView>> {
    return this.reviews.adminList(query);
  }

  @Get(':id')
  @RequirePermissions(Permissions.ReviewsModerate)
  @ApiOperation({ summary: 'Review detail' })
  get(@Param('id') id: string): Promise<AdminReviewView> {
    return this.reviews.adminGet(id);
  }

  @Patch(':id/status')
  @RequirePermissions(Permissions.ReviewsModerate)
  @ApiOperation({ summary: 'Approve or reject (audited; recalculates the product rating)' })
  async moderate(
    @Param('id') id: string,
    @Body() dto: ModerateReviewDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminReviewView> {
    const review = await this.reviews.moderate(id, dto, actor.id);
    await this.audit.record({
      actorId: actor.id,
      action: 'review.moderate',
      entityType: 'Review',
      entityId: id,
      metadata: { status: dto.status, note: dto.note, productId: review.productId },
      request: req,
    });
    return review;
  }
}
