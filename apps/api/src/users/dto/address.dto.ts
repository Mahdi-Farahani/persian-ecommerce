import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IRAN_MOBILE_REGEX,
  IRAN_POSTAL_CODE_REGEX,
  IRAN_PROVINCES,
  normalizeIranMobile,
  toEnglishDigits,
} from '@pe/shared';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const mobile = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? (normalizeIranMobile(value) ?? value) : value;
const digits = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? toEnglishDigits(value.trim()) : value;

export class CreateAddressDto {
  @ApiProperty({ example: 'خانه' })
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  title: string;

  @ApiProperty({ example: 'علی رضایی' })
  @Transform(trim)
  @IsString()
  @Length(2, 150)
  recipientName: string;

  @ApiProperty({ example: '09123456789' })
  @Transform(mobile)
  @Matches(IRAN_MOBILE_REGEX, { message: 'شماره موبایل گیرنده معتبر نیست' })
  recipientPhone: string;

  @ApiProperty({ enum: IRAN_PROVINCES, example: 'تهران' })
  @Transform(trim)
  @IsIn(IRAN_PROVINCES, { message: 'استان معتبر نیست' })
  province: string;

  @ApiProperty({ example: 'تهران' })
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  city: string;

  @ApiProperty({ example: 'خیابان ولیعصر، کوچه ۱۲، پلاک ۳' })
  @Transform(trim)
  @IsString()
  @Length(5, 500)
  addressLine: string;

  @ApiProperty({ example: '1234567890' })
  @Transform(digits)
  @Matches(IRAN_POSTAL_CODE_REGEX, { message: 'کد پستی باید ۱۰ رقم باشد' })
  postalCode: string;

  @ApiPropertyOptional({ example: 35.6892 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: 51.389 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto extends PartialType(CreateAddressDto) {}

export class AddressDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() recipientName: string;
  @ApiProperty() recipientPhone: string;
  @ApiProperty() province: string;
  @ApiProperty() city: string;
  @ApiProperty() addressLine: string;
  @ApiProperty() postalCode: string;
  @ApiProperty({ nullable: true, type: Number }) latitude: number | null;
  @ApiProperty({ nullable: true, type: Number }) longitude: number | null;
  @ApiProperty() isDefault: boolean;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}
