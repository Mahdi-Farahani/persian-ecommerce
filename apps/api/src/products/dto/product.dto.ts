import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  MAX_MONEY_AMOUNT,
  ProductSortOptions,
  ProductStatuses,
  VariantStatuses,
  type ProductSort,
  type ProductStatus,
  type VariantStatus,
} from '@pe/shared';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const toBool = ({ value }: { value: unknown }): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;
const toList = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string'
    ? value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    : value;

// --- public listing ----------------------------------------------------------

export class ProductListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Category slug (includes sub-categories)' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 180)
  category?: string;

  @ApiPropertyOptional({ description: 'Brand slug(s), comma separated', type: String })
  @IsOptional()
  @Transform(toList)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  brand?: string[];

  @ApiPropertyOptional({ description: 'Minimum price in IRR' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum price in IRR' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Only products with available stock' })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional({
    description: 'Attribute filters: attr[color]=black,white',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  attr?: Record<string, string | string[]>;

  @ApiPropertyOptional({ enum: ProductSortOptions, default: 'newest' })
  @IsOptional()
  @IsIn(ProductSortOptions)
  sort?: ProductSort;

  @ApiPropertyOptional({ description: 'Free-text search' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  q?: string;
}

// --- admin -------------------------------------------------------------------

export class ProductAttributeInputDto {
  @ApiProperty() @IsUUID('7') attributeId: string;

  @ApiPropertyOptional({ description: 'Value id for SELECT attributes' })
  @ValidateIf((o: ProductAttributeInputDto) => o.valueText === undefined)
  @IsUUID('7')
  valueId?: string;

  @ApiPropertyOptional({ description: 'Free value for TEXT/NUMBER/BOOLEAN attributes' })
  @ValidateIf((o: ProductAttributeInputDto) => o.valueId === undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 255)
  valueText?: string;
}

export class ProductSpecificationInputDto {
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @Length(1, 100) group?: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 150) name: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 500) value: string;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;
}

export class VariantAttributeInputDto {
  @ApiProperty() @IsUUID('7') attributeId: string;
  @ApiProperty() @IsUUID('7') valueId: string;
}

export class CreateVariantDto {
  @ApiProperty({ example: 'GLX-S25-256-BLK' })
  @Transform(trim)
  @IsString()
  @Length(1, 64)
  sku: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 64)
  barcode?: string;

  @ApiPropertyOptional({ example: '۲۵۶ گیگابایت / مشکی' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 255)
  title?: string;

  @ApiProperty({ description: 'Price in IRR', example: 450_000_000 })
  @IsInt()
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  price: number;

  @ApiPropertyOptional({
    description: 'Compare-at price in IRR (must exceed price)',
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  compareAtPrice?: number | null;

  @ApiPropertyOptional({ enum: VariantStatuses, default: 'ACTIVE' })
  @IsOptional()
  @IsIn(VariantStatuses)
  status?: VariantStatus;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  weightGrams?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;

  @ApiPropertyOptional({ type: [VariantAttributeInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => VariantAttributeInputDto)
  attributeValues?: VariantAttributeInputDto[];

  @ApiPropertyOptional({ description: 'Initial stock quantity', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  initialStock?: number;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  lowStockThreshold?: number;
}

export class UpdateVariantDto extends PartialType(CreateVariantDto) {}

export class ProductImageInputDto {
  @ApiProperty({ example: '/uploads/catalog/abc.webp' })
  @Transform(trim)
  @IsString()
  @Length(1, 500)
  url: string;

  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(255) alt?: string;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isPrimary?: boolean;
  @ApiPropertyOptional({ description: 'Attach the image to a variant', nullable: true })
  @IsOptional()
  @IsUUID('7')
  variantId?: string | null;
}

export class UpdateProductImageDto extends PartialType(ProductImageInputDto) {}

export class CreateProductDto {
  @ApiProperty({ example: 'گوشی موبایل سامسونگ Galaxy S25' })
  @Transform(trim)
  @IsString()
  @Length(2, 255)
  title: string;

  @ApiPropertyOptional({ example: 'Samsung Galaxy S25' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 255)
  titleEn?: string;

  @ApiPropertyOptional({ description: 'Generated from the title when omitted' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 180)
  slug?: string;

  @ApiProperty() @IsUUID('7') categoryId: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID('7')
  brandId?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20_000) description?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  shortDescription?: string;

  @ApiPropertyOptional({ enum: ProductStatuses, default: 'DRAFT' })
  @IsOptional()
  @IsIn(ProductStatuses)
  status?: ProductStatus;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(1_000_000) weightGrams?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) seoTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) seoDescription?: string;

  @ApiPropertyOptional({ type: [ProductAttributeInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeInputDto)
  attributes?: ProductAttributeInputDto[];

  @ApiPropertyOptional({ type: [ProductSpecificationInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ProductSpecificationInputDto)
  specifications?: ProductSpecificationInputDto[];

  @ApiProperty({ type: [CreateVariantDto], description: 'At least one variant' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants: CreateVariantDto[];

  @ApiPropertyOptional({ type: [ProductImageInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ProductImageInputDto)
  images?: ProductImageInputDto[];
}

export class UpdateProductDto extends PartialType(
  // Variants and images are managed through their own endpoints after creation.
  class extends CreateProductDto {
    declare variants: never;
    declare images: never;
  },
) {
  @ApiPropertyOptional({
    type: [ProductAttributeInputDto],
    description: 'Replaces all attribute values',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeInputDto)
  declare attributes?: ProductAttributeInputDto[];

  @ApiPropertyOptional({
    type: [ProductSpecificationInputDto],
    description: 'Replaces all specifications',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ProductSpecificationInputDto)
  declare specifications?: ProductSpecificationInputDto[];
}

export class UpdateProductStatusDto {
  @ApiProperty({ enum: ProductStatuses })
  @IsIn(ProductStatuses)
  status: ProductStatus;
}

export class AdminProductsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @Length(1, 100) search?: string;
  @ApiPropertyOptional({ enum: ProductStatuses })
  @IsOptional()
  @IsIn(ProductStatuses)
  status?: ProductStatus;
  @ApiPropertyOptional() @IsOptional() @IsUUID('7') categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID('7') brandId?: string;
}

export class ReorderImagesDto {
  @ApiProperty({ type: [String], description: 'Image ids in display order' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @IsUUID('7', { each: true })
  imageIds: string[];
}
