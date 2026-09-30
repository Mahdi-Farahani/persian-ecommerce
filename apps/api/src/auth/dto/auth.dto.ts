import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IRAN_MOBILE_REGEX,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_REGEX,
  normalizeIranMobile,
  toEnglishDigits,
} from '@pe/shared';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const lower = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const mobile = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? (normalizeIranMobile(value) ?? toEnglishDigits(value.trim())) : value;

export class PasswordDto {
  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH, example: 'Str0ngPassw0rd' })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `رمز عبور باید حداقل ${PASSWORD_MIN_LENGTH} کاراکتر باشد`,
  })
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_POLICY_REGEX, { message: 'رمز عبور باید شامل حرف و عدد باشد' })
  password: string;
}

export class RegisterDto extends PasswordDto {
  @ApiPropertyOptional({ example: 'user@example.com' })
  @ValidateIf((o: RegisterDto) => o.email !== undefined || o.phone === undefined)
  @Transform(lower)
  @IsEmail({}, { message: 'ایمیل معتبر نیست' })
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: '09123456789' })
  @ValidateIf((o: RegisterDto) => o.phone !== undefined || o.email === undefined)
  @Transform(mobile)
  @Matches(IRAN_MOBILE_REGEX, { message: 'شماره موبایل معتبر نیست' })
  phone?: string;

  @ApiPropertyOptional({ example: 'علی' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'رضایی' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  lastName?: string;
}

export class LoginDto {
  @ApiProperty({
    description: 'Email address or Iranian mobile number',
    example: 'user@example.com',
  })
  @Transform(lower)
  @IsString()
  @Length(3, 255)
  identifier: string;

  @ApiProperty()
  @IsString()
  @Length(1, PASSWORD_MAX_LENGTH)
  password: string;
}

export class RefreshDto {
  @ApiPropertyOptional({ description: 'Refresh token (only needed when not using cookies)' })
  @IsOptional()
  @IsString()
  @Length(20, 200)
  refreshToken?: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Email address or Iranian mobile number' })
  @Transform(lower)
  @IsString()
  @Length(3, 255)
  identifier: string;
}

export class ResetPasswordDto extends PasswordDto {
  @ApiProperty()
  @IsString()
  @Length(20, 200)
  token: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @Length(1, PASSWORD_MAX_LENGTH)
  currentPassword: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `رمز عبور باید حداقل ${PASSWORD_MIN_LENGTH} کاراکتر باشد`,
  })
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_POLICY_REGEX, { message: 'رمز عبور باید شامل حرف و عدد باشد' })
  newPassword: string;
}

export const VERIFICATION_CHANNELS = ['EMAIL', 'PHONE'] as const;
export type VerificationChannelValue = (typeof VERIFICATION_CHANNELS)[number];

export class RequestVerificationDto {
  @ApiProperty({ enum: VERIFICATION_CHANNELS })
  @IsIn(VERIFICATION_CHANNELS)
  channel: VerificationChannelValue;
}

export class ConfirmVerificationDto extends RequestVerificationDto {
  @ApiProperty({ example: '123456' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? toEnglishDigits(value.trim()) : value,
  )
  @IsString()
  @Matches(/^\d{6}$/, { message: 'کد تأیید باید ۶ رقم باشد' })
  code: string;
}
