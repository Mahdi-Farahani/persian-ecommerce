import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PaymentEnvironments,
  PaymentProviders,
  PaymentStatuses,
  type PaymentEnvironment,
  type PaymentProviderName,
  type PaymentStatus,
} from '@pe/shared';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Ensures a record only holds short string values (credential/setting maps). */
const stringMap = ({ value }: { value: unknown }): unknown => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const out: Record<string, string> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (typeof inner !== 'string' || key.length > 64 || inner.length > 2000) return 'invalid';
    out[key] = inner;
  }
  return out;
};

export class CreatePaymentDto {
  @ApiProperty() @IsUUID('7') orderId: string;

  @ApiPropertyOptional({ enum: PaymentProviders, description: 'Defaults to the default gateway' })
  @IsOptional()
  @IsIn(PaymentProviders)
  provider?: PaymentProviderName;
}

export class AdminPaymentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Order number, authority, reference, customer email/phone' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  search?: string;

  @ApiPropertyOptional({ enum: PaymentStatuses })
  @IsOptional()
  @IsIn(PaymentStatuses)
  status?: PaymentStatus;

  @ApiPropertyOptional({ enum: PaymentProviders })
  @IsOptional()
  @IsIn(PaymentProviders)
  provider?: PaymentProviderName;

  @ApiPropertyOptional() @IsOptional() @IsUUID('7') orderId?: string;
}

export class RefundPaymentDto {
  @ApiPropertyOptional({ description: 'Reason recorded in the ledger and order history' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class UpdatePaymentGatewayDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;

  @ApiPropertyOptional({ enum: PaymentEnvironments })
  @IsOptional()
  @IsIn(PaymentEnvironments)
  environment?: PaymentEnvironment;

  @ApiPropertyOptional({
    description: 'Credential values by field key; masked or empty values keep the stored value',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @Transform(stringMap)
  @IsObject({ message: 'credentials must be a map of strings' })
  credentials?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Non-secret settings by field key',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @Transform(stringMap)
  @IsObject({ message: 'settings must be a map of strings' })
  settings?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Required when enabling a gateway in PRODUCTION' })
  @IsOptional()
  @IsBoolean()
  confirmProduction?: boolean;
}
