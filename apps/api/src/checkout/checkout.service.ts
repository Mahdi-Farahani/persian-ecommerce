import { Injectable } from '@nestjs/common';
import type { CartWarning, CheckoutQuote, ShippingMethodView } from '@pe/shared';
import { CartService } from '../cart/cart.service.js';
import { NotFoundAppException, UnprocessableAppException } from '../common/errors/app.exception.js';
import { PricingService } from '../pricing/pricing.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ShippingService } from '../shipping/shipping.service.js';

export interface QuoteInput {
  userId: string;
  addressId: string;
  shippingMethodCode: string;
}

/**
 * Computes an authoritative checkout quote: re-validates the cart, verifies
 * the address belongs to the user, prices shipping and reports blocking
 * issues. Order creation consumes the same quote so totals can never differ
 * from what the customer saw.
 */
@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly shipping: ShippingService,
    private readonly pricing: PricingService,
  ) {}

  async shippingOptions(userId: string): Promise<ShippingMethodView[]> {
    const cart = await this.cart.get({ userId });
    return this.shipping.listActive(cart.totals.total);
  }

  async quote(input: QuoteInput): Promise<CheckoutQuote> {
    const cartRow = await this.cart.findCart({ userId: input.userId }, false);
    if (!cartRow || cartRow.items.length === 0) {
      throw new UnprocessableAppException('CART_EMPTY', 'سبد خرید شما خالی است');
    }
    const resolved = await this.cart.resolve(cartRow, input.userId);

    const address = await this.prisma.address.findFirst({
      where: { id: input.addressId, userId: input.userId },
    });
    if (!address) throw new NotFoundAppException('ADDRESS_NOT_FOUND', 'آدرس پیدا نشد');

    const method = await this.shipping.findActiveByCode(input.shippingMethodCode);
    if (!method)
      throw new NotFoundAppException(
        'SHIPPING_METHOD_NOT_FOUND',
        'روش ارسال انتخاب‌شده در دسترس نیست',
      );

    const shippingView = this.shipping.toView(method, resolved.view.totals.total);
    const grandTotal = this.pricing.grandTotal(resolved.view.totals.total, shippingView.fee);

    const issues: CartWarning[] = resolved.view.warnings.filter((w) =>
      ['OUT_OF_STOCK', 'QUANTITY_REDUCED', 'ITEM_UNAVAILABLE'].includes(w.code),
    );

    return {
      cart: resolved.view,
      address: {
        id: address.id,
        title: address.title,
        recipientName: address.recipientName,
        recipientPhone: address.recipientPhone,
        province: address.province,
        city: address.city,
        addressLine: address.addressLine,
        postalCode: address.postalCode,
      },
      shippingMethod: shippingView,
      totals: { ...resolved.view.totals, shippingFee: shippingView.fee, grandTotal },
      issues,
      canPlaceOrder: issues.length === 0 && resolved.view.items.length > 0,
    };
  }
}
