import { ApiProperty } from '@nestjs/swagger';
import { CART_MAX_LINE_QUANTITY } from '@pe/shared';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty() @IsUUID('7') variantId: string;
  @ApiProperty({ minimum: 1, maximum: CART_MAX_LINE_QUANTITY, default: 1 })
  @IsInt()
  @Min(1)
  @Max(CART_MAX_LINE_QUANTITY)
  quantity: number = 1;
}

export class UpdateCartItemDto {
  @ApiProperty({ minimum: 0, maximum: CART_MAX_LINE_QUANTITY, description: '0 removes the item' })
  @IsInt()
  @Min(0)
  @Max(CART_MAX_LINE_QUANTITY)
  quantity: number;
}
