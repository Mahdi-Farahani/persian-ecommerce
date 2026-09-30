import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { MAX_MONEY_AMOUNT } from '@pe/shared';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

const DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED'] as const;
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCouponDto {
  @ApiProperty({ example: 'WELCOME10' })
  @Transform(trim)
  @IsString()
  @Length(3, 50)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'کد تخفیف فقط می‌تواند شامل حروف انگلیسی، عدد، خط تیره و زیرخط باشد',
  })
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiProperty({ enum: DISCOUNT_TYPES })
  @IsIn(DISCOUNT_TYPES)
  type: (typeof DISCOUNT_TYPES)[number];

  @ApiProperty({ description: 'Percent (0-100) or fixed IRR amount' })
  @IsInt()
  @Min(1)
  @ValidateIf((o: CreateCouponDto) => o.type === 'PERCENTAGE')
  @Max(100)
  value: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  maxDiscountAmount?: number | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  minCartAmount?: number | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsISO8601() startsAt?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsISO8601() endsAt?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsInt() @Min(1) usageLimit?:
    number | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsInt() @Min(1) usageLimitPerUser?:
    number | null;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateCouponDto extends PartialType(CreateCouponDto) {}

export class AdminCouponsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @Length(1, 50) search?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  isActive?: boolean;
}

export class ApplyCouponDto {
  @ApiProperty({ example: 'WELCOME10' })
  @Transform(trim)
  @IsString()
  @Length(3, 50)
  code: string;
}
