import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatuses, type OrderStatus } from '@pe/shared';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class PlaceOrderDto {
  @ApiProperty() @IsUUID('7') addressId: string;

  @ApiProperty({ example: 'post-standard' })
  @Transform(trim)
  @IsString()
  @Length(2, 50)
  @Matches(/^[a-z0-9-]+$/)
  shippingMethodCode: string;

  @ApiPropertyOptional({ description: 'Note for the seller / courier' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AdminOrdersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Order number, customer email/phone or recipient' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  search?: string;

  @ApiPropertyOptional({ enum: OrderStatuses })
  @IsOptional()
  @IsIn(OrderStatuses)
  status?: OrderStatus;
  @ApiPropertyOptional() @IsOptional() @IsUUID('7') userId?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() to?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatuses }) @IsIn(OrderStatuses) status: OrderStatus;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(500) note?: string;
}

export class CreateShipmentDto {
  @ApiPropertyOptional({ example: 'پست پیشتاز' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  carrier?: string;
  @ApiPropertyOptional({ example: 'RR123456789IR' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  trackingCode?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(255) note?: string;
}
