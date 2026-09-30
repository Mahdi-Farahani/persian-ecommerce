import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser, CheckoutQuote, ShippingMethodView } from '@pe/shared';
import { CurrentUser } from '../auth/auth.decorators.js';
import { CheckoutService } from './checkout.service.js';
import { CheckoutQuoteDto } from './dto/checkout.dto.js';

@ApiTags('checkout')
@ApiBearerAuth('access-token')
@ApiCookieAuth('pe_access')
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Get('shipping-methods')
  @ApiOperation({ summary: 'Shipping methods with fees for the current cart' })
  shippingMethods(@CurrentUser() user: AuthUser): Promise<ShippingMethodView[]> {
    return this.checkout.shippingOptions(user.id);
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate cart, address and shipping; returns authoritative totals' })
  validate(@CurrentUser() user: AuthUser, @Body() dto: CheckoutQuoteDto): Promise<CheckoutQuote> {
    return this.checkout.quote({
      userId: user.id,
      addressId: dto.addressId,
      shippingMethodCode: dto.shippingMethodCode,
    });
  }
}
