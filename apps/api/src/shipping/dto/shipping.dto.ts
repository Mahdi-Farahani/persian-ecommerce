import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { MAX_MONEY_AMOUNT } from '@pe/shared';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateShippingMethodDto {
  @ApiProperty({ example: 'post-standard' })
  @Transform(trim)
  @IsString()
  @Length(2, 50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'کد فقط می‌تواند شامل حروف کوچک انگلیسی، عدد و خط تیره باشد',
  })
  code: string;

  @ApiProperty({ example: 'پست پیشتاز' }) @Transform(trim) @IsString() @Length(2, 150) name: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description?: string;
  @ApiProperty({ description: 'Flat fee in IRR', example: 350_000 })
  @IsInt()
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  baseFee: number;
  @ApiPropertyOptional({
    description: 'Free shipping at/above this subtotal (IRR)',
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  freeAboveAmount?: number | null;
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  estimatedDaysMin?: number;
  @ApiPropertyOptional({ default: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  estimatedDaysMax?: number;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;
}

export class UpdateShippingMethodDto extends PartialType(CreateShippingMethodDto) {}
