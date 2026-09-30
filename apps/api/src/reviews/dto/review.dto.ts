import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  REVIEW_BODY_MAX,
  REVIEW_MAX_RATING,
  REVIEW_MIN_RATING,
  REVIEW_TITLE_MAX,
  ReviewStatuses,
  type ReviewStatus,
} from '@pe/shared';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateReviewDto {
  @ApiProperty({ minimum: REVIEW_MIN_RATING, maximum: REVIEW_MAX_RATING })
  @IsInt()
  @Min(REVIEW_MIN_RATING)
  @Max(REVIEW_MAX_RATING)
  rating: number;

  @ApiProperty({ maxLength: REVIEW_TITLE_MAX })
  @Transform(trim)
  @IsString()
  @Length(3, REVIEW_TITLE_MAX)
  title: string;

  @ApiProperty({ maxLength: REVIEW_BODY_MAX })
  @Transform(trim)
  @IsString()
  @Length(10, REVIEW_BODY_MAX)
  body: string;
}

export class UpdateReviewDto extends PartialType(CreateReviewDto) {}

export const ReviewSortOptions = ['newest', 'highest', 'lowest'] as const;
export type ReviewSort = (typeof ReviewSortOptions)[number];

export class ProductReviewsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ReviewSortOptions, default: 'newest' })
  @IsOptional()
  @IsIn(ReviewSortOptions)
  sort?: ReviewSort;
}

export class AdminReviewsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ReviewStatuses })
  @IsOptional()
  @IsIn(ReviewStatuses)
  status?: ReviewStatus;

  @ApiPropertyOptional() @IsOptional() @IsUUID('7') productId?: string;

  @ApiPropertyOptional({ description: 'Title/body text, product title or customer email' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  search?: string;
}

export class ModerateReviewDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsIn(['APPROVED', 'REJECTED'])
  status: Extract<ReviewStatus, 'APPROVED' | 'REJECTED'>;

  @ApiPropertyOptional({ description: 'Shown to the author when rejecting' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}
