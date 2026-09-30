import { ApiProperty, ApiPropertyOptional, PartialType, PickType } from '@nestjs/swagger';
import {
  MAX_COMMISSION_BPS,
  MAX_MONEY_AMOUNT,
  SellerStatuses,
  SettlementStatuses,
  type SellerStatus,
  type SettlementStatus,
} from '@pe/shared';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { VariantAttributeInputDto } from '../../products/dto/product.dto.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const toEnglishDigits = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string'
    ? value.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).trim()
    : value;

export class ApplySellerDto {
  @ApiProperty({ example: 'فروشگاه دیجی‌کالا' })
  @Transform(trim)
  @IsString()
  @Length(3, 150)
  storeName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ example: '09123456789' })
  @Transform(toEnglishDigits)
  @IsString()
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل معتبر نیست' })
  contactPhone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  legalName?: string;

  @ApiPropertyOptional({ description: 'کد ملی / شناسه ملی' })
  @IsOptional()
  @Transform(toEnglishDigits)
  @IsString()
  @Matches(/^\d{10,11}$/, { message: 'کد ملی معتبر نیست' })
  nationalId?: string;

  @ApiPropertyOptional({ example: 'IR062960000000100324200001' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/\s+/g, '').toUpperCase() : value,
  )
  @IsString()
  @Matches(/^IR\d{24}$/, { message: 'شماره شبا باید با IR شروع شود و ۲۴ رقم داشته باشد' })
  iban?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  province?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(100) city?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  addressLine?: string;
}

export class UpdateSellerProfileDto extends PartialType(ApplySellerDto) {}

export class AdminSellersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: SellerStatuses })
  @IsOptional()
  @IsIn(SellerStatuses)
  status?: SellerStatus;
  @ApiPropertyOptional({ description: 'Store name, owner email or phone' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  search?: string;
}

export class UpdateSellerStatusDto {
  @ApiProperty({ enum: ['APPROVED', 'SUSPENDED', 'REJECTED'] })
  @IsIn(['APPROVED', 'SUSPENDED', 'REJECTED'])
  status: Extract<SellerStatus, 'APPROVED' | 'SUSPENDED' | 'REJECTED'>;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(500) reason?: string;
}

export class UpdateSellerCommissionDto {
  @ApiProperty({
    description: 'Basis points (1000 = 10%)',
    minimum: 0,
    maximum: MAX_COMMISSION_BPS,
  })
  @IsInt()
  @Min(0)
  @Max(MAX_COMMISSION_BPS)
  commissionBps: number;
}

export class CreateOfferDto {
  @ApiProperty({ example: 'SHOP-A-S25-BLK' })
  @Transform(trim)
  @IsString()
  @Length(2, 64)
  @Matches(/^[A-Za-z0-9._-]+$/)
  sku: string;

  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(255) title?: string;

  @ApiProperty({ description: 'IRR' }) @IsInt() @Min(1) @Max(MAX_MONEY_AMOUNT) price: number;
  @ApiPropertyOptional({ description: 'IRR, must exceed price', nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_MONEY_AMOUNT)
  compareAtPrice?: number | null;

  @ApiPropertyOptional({ type: [VariantAttributeInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantAttributeInputDto)
  attributeValues?: VariantAttributeInputDto[];

  @ApiPropertyOptional({ default: 0 })
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

export class UpdateOfferDto extends PartialType(
  PickType(CreateOfferDto, ['title', 'price', 'compareAtPrice'] as const),
) {
  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
}

export class SellerAdjustStockDto {
  @ApiProperty({ description: 'Signed quantity' })
  @IsInt()
  @Min(-1_000_000)
  @Max(1_000_000)
  quantity: number;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(255) note?: string;
}

export class SellerOrdersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Only orders still awaiting my shipment' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  @IsBoolean()
  awaitingShipment?: boolean;
}

export class SellerShipmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  carrier?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  trackingCode?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(255) note?: string;
}

export class SettlementsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID('7') sellerId?: string;
  @ApiPropertyOptional({ enum: SettlementStatuses })
  @IsOptional()
  @IsIn(SettlementStatuses)
  status?: SettlementStatus;
}

export class CreateSettlementDto {
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(500) note?: string;
}

export class UpdateSettlementDto {
  @ApiProperty({ enum: ['PAID', 'CANCELLED'] })
  @IsIn(['PAID', 'CANCELLED'])
  status: Extract<SettlementStatus, 'PAID' | 'CANCELLED'>;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  paymentReference?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(500) note?: string;
}
