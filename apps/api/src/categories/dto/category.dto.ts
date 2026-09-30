import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CategoryAttributeLinkDto {
  @ApiProperty() @IsUUID('7') attributeId: string;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isRequired?: boolean;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;
}

export class CreateCategoryDto {
  @ApiProperty({ example: 'گوشی موبایل' })
  @Transform(trim)
  @IsString()
  @Length(1, 150)
  name: string;

  @ApiPropertyOptional({ description: 'Generated from the name when omitted' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 180)
  slug?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID('7')
  parentId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  seoTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoDescription?: string;

  @ApiPropertyOptional({ type: [CategoryAttributeLinkDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CategoryAttributeLinkDto)
  attributes?: CategoryAttributeLinkDto[];
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
