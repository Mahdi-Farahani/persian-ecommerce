import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { AttributeTypes, type AttributeType } from '@pe/shared';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class AttributeValueInputDto {
  @ApiPropertyOptional({ description: 'Existing value id (omit to create)' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'مشکی' })
  @Transform(trim)
  @IsString()
  @Length(1, 150)
  value: string;

  @ApiPropertyOptional({ description: 'Generated from value when omitted' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 150)
  slug?: string;

  @ApiPropertyOptional({ example: '#000000' })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  colorHex?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;
}

export class CreateAttributeDto {
  @ApiProperty({ example: 'رنگ' })
  @Transform(trim)
  @IsString()
  @Length(1, 150)
  name: string;

  @ApiPropertyOptional({ example: 'color' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  slug?: string;

  @ApiPropertyOptional({ enum: AttributeTypes, default: 'SELECT' })
  @IsOptional()
  @IsIn(AttributeTypes)
  type?: AttributeType;

  @ApiPropertyOptional({ example: 'گیگابایت' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 30)
  unit?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isVariant?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isFilterable?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;

  @ApiPropertyOptional({ type: [AttributeValueInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => AttributeValueInputDto)
  values?: AttributeValueInputDto[];
}

export class UpdateAttributeDto extends PartialType(CreateAttributeDto) {}
