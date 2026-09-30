import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsISO8601, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class AuditLogsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Action prefix, e.g. `order.` or `payment_gateway.update`' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-z0-9_.-]+$/i)
  action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  entityType?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 64)
  entityId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID('7') actorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() to?: string;
}
