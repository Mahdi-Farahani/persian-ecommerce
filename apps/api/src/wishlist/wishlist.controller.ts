import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser, CartView, WishlistView } from '@pe/shared';
import { CurrentUser } from '../auth/auth.decorators.js';
import { WishlistService } from './wishlist.service.js';

@ApiTags('wishlist')
@ApiBearerAuth('access-token')
@ApiCookieAuth('pe_access')
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  @ApiOperation({ summary: 'My wishlist with product cards' })
  list(@CurrentUser() user: AuthUser): Promise<WishlistView> {
    return this.wishlist.list(user.id);
  }

  @Get('ids')
  @ApiOperation({ summary: 'Product ids in my wishlist' })
  ids(@CurrentUser() user: AuthUser): Promise<string[]> {
    return this.wishlist.ids(user.id);
  }

  @Post(':productId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add a product (idempotent)' })
  add(@CurrentUser() user: AuthUser, @Param('productId') productId: string): Promise<WishlistView> {
    return this.wishlist.add(user.id, productId);
  }

  @Delete(':productId')
  @ApiOperation({ summary: 'Remove a product (idempotent)' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
  ): Promise<WishlistView> {
    return this.wishlist.remove(user.id, productId);
  }

  @Post(':productId/move-to-cart')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add the default purchasable variant to the cart and drop it from the wishlist',
  })
  moveToCart(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
  ): Promise<{ cart: CartView; wishlist: WishlistView }> {
    return this.wishlist.moveToCart(user.id, productId);
  }
}
