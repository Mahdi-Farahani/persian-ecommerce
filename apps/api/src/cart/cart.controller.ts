import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CartView } from '@pe/shared';
import type { Response } from 'express';
import { OptionalAuth } from '../auth/auth.decorators.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { AppConfigService } from '../config/app-config.service.js';
import { ApplyCouponDto } from '../coupons/dto/coupon.dto.js';
import { newCartToken, readCartToken, setCartCookie } from './cart.cookies.js';
import { type CartOwner, CartService } from './cart.service.js';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto.js';

/**
 * Cart endpoints work for guests and signed-in users alike. Guests are
 * identified by an httpOnly `pe_cart` cookie that is issued on first write.
 */
@ApiTags('cart')
@ApiBearerAuth('access-token')
@ApiCookieAuth('pe_access')
@OptionalAuth()
@Controller('cart')
export class CartController {
  constructor(
    private readonly cart: CartService,
    private readonly config: AppConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Current cart (guest or user)' })
  get(@Req() req: AuthenticatedRequest): Promise<CartView> {
    const owner = this.owner(req);
    return owner ? this.cart.get(owner) : Promise.resolve(this.cart['emptyView']());
  }

  @Post('items')
  @ApiOperation({ summary: 'Add an item (quantity accumulates, capped by stock)' })
  addItem(
    @Body() dto: AddCartItemDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CartView> {
    return this.cart.addItem(this.ownerOrCreate(req, res), dto.variantId, dto.quantity);
  }

  @Patch('items/:itemId')
  @ApiOperation({ summary: 'Set item quantity (0 removes)' })
  updateItem(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<CartView> {
    return this.cart.updateItem(this.requireOwner(req), itemId, dto.quantity);
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Remove an item' })
  removeItem(@Param('itemId') itemId: string, @Req() req: AuthenticatedRequest): Promise<CartView> {
    return this.cart.removeItem(this.requireOwner(req), itemId);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Empty the cart' })
  clear(@Req() req: AuthenticatedRequest): Promise<CartView> {
    const owner = this.owner(req);
    return owner ? this.cart.clear(owner) : Promise.resolve(this.cart['emptyView']());
  }

  @Post('coupon')
  @ApiOperation({ summary: 'Apply a coupon code' })
  applyCoupon(
    @Body() dto: ApplyCouponDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CartView> {
    return this.cart.applyCoupon(this.ownerOrCreate(req, res), dto.code);
  }

  @Delete('coupon')
  @ApiOperation({ summary: 'Remove the coupon' })
  removeCoupon(@Req() req: AuthenticatedRequest): Promise<CartView> {
    return this.cart.removeCoupon(this.requireOwner(req));
  }

  private owner(req: AuthenticatedRequest): CartOwner | null {
    if (req.user) return { userId: req.user.id };
    const token = readCartToken(req);
    return token ? { token } : null;
  }

  private requireOwner(req: AuthenticatedRequest): CartOwner {
    const owner = this.owner(req);
    if (owner) return owner;
    // No cart exists for this visitor: behave as an empty cart lookup.
    return { token: newCartToken() };
  }

  private ownerOrCreate(req: AuthenticatedRequest, res: Response): CartOwner {
    if (req.user) return { userId: req.user.id };
    const existing = readCartToken(req);
    if (existing) return { token: existing };
    const token = newCartToken();
    setCartCookie(res, this.config.auth, token);
    return { token };
  }
}
