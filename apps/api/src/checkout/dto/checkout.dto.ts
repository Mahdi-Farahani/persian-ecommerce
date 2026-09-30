import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, IsUUID, Length, Matches } from 'class-validator';

export class CheckoutQuoteDto {
  @ApiProperty() @IsUUID('7') addressId: string;

  @ApiProperty({ example: 'post-standard' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 50)
  @Matches(/^[a-z0-9-]+$/)
  shippingMethodCode: string;
}
