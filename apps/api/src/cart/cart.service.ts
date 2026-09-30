import { Injectable, Logger } from '@nestjs/common';
import {
  CART_MAX_LINE_QUANTITY,
  CART_MAX_LINES,
  type AppliedCoupon,
  type CartView,
  type CartWarning,
} from '@pe/shared';
import { NotFoundAppException, UnprocessableAppException } from '../common/errors/app.exception.js';
import { money, moneyOrNull } from '../common/utils/money.util.js';
import { COUPON_MESSAGES, CouponsService } from '../coupons/coupons.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PricingService, type CouponRule } from '../pricing/pricing.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GUEST_CART_TTL_MS, hashCartToken } from './cart.cookies.js';

/** How the caller is identified: a signed-in user or a guest cart token. */
export type CartOwner =
  { userId: string; token?: undefined } | { userId?: undefined; token: string };

const cartInclude = {
  items: {
    orderBy: { createdAt: 'asc' },
    include: {
      variant: {
        include: {
          inventory: true,
          product: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              images: {
                orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
                take: 1,
                select: { url: true, alt: true, variantId: true },
              },
            },
          },
          images: { take: 1, orderBy: { sortOrder: 'asc' }, select: { url: true, alt: true } },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

type CartRow = Prisma.CartGetPayload<{ include: typeof cartInclude }>;
type CartItemRow = CartRow['items'][number];

export interface ResolvedCart {
  view: CartView;
  couponRule: CouponRule | null;
  row: CartRow;
}

const PUBLIC_STATUSES = new Set(['ACTIVE', 'OUT_OF_STOCK']);

/**
 * Cart persistence and validation. Totals are always recomputed from current
 * prices and availability; nothing from the client is trusted.
 */
@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly coupons: CouponsService,
  ) {}

  private ownerWhere(owner: CartOwner): Prisma.CartWhereInput {
    return owner.userId !== undefined
      ? { userId: owner.userId, status: 'ACTIVE' }
      : { sessionHash: hashCartToken(owner.token), status: 'ACTIVE', userId: null };
  }

  /** Returns the owner's active cart, creating it when `create` is set. */
  async findCart(owner: CartOwner, create: boolean): Promise<CartRow | null> {
    const existing = await this.prisma.cart.findFirst({
      where: this.ownerWhere(owner),
      include: cartInclude,
    });
    if (existing || !create) return existing;
    return this.prisma.cart.create({
      data:
        owner.userId !== undefined
          ? { userId: owner.userId }
          : {
              sessionHash: hashCartToken(owner.token),
              expiresAt: new Date(Date.now() + GUEST_CART_TTL_MS),
            },
      include: cartInclude,
    });
  }

  async get(owner: CartOwner): Promise<CartView> {
    const cart = await this.findCart(owner, false);
    if (!cart) return this.emptyView();
    return (await this.resolve(cart, owner.userId ?? null)).view;
  }

  async addItem(owner: CartOwner, variantId: string, quantity: number): Promise<CartView> {
    const cart = (await this.findCart(owner, true))!;
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { inventory: true, product: { select: { status: true } } },
    });
    if (!variant || variant.status !== 'ACTIVE' || !PUBLIC_STATUSES.has(variant.product.status)) {
      throw new NotFoundAppException('VARIANT_NOT_FOUND', 'این کالا در دسترس نیست');
    }
    const existing = cart.items.find((i) => i.variantId === variantId);
    if (!existing && cart.items.length >= CART_MAX_LINES) {
      throw new UnprocessableAppException(
        'CART_FULL',
        `حداکثر ${CART_MAX_LINES} کالای متفاوت می‌توانید در سبد داشته باشید`,
      );
    }
    const requested = (existing?.quantity ?? 0) + quantity;
    const available = this.availableOf(variant.inventory);
    const capped = Math.min(requested, CART_MAX_LINE_QUANTITY, available);
    if (capped <= 0) {
      throw new UnprocessableAppException('OUT_OF_STOCK', 'موجودی این کالا به پایان رسیده است');
    }
    if (existing) {
      await this.prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: capped } });
    } else {
      await this.prisma.cartItem.create({
        data: { cartId: cart.id, variantId, quantity: capped, priceAtAdd: variant.price },
      });
    }
    await this.touch(cart.id);
    return this.get(owner);
  }

  async updateItem(owner: CartOwner, itemId: string, quantity: number): Promise<CartView> {
    const cart = await this.findCart(owner, false);
    const item = cart?.items.find((i) => i.id === itemId);
    if (!cart || !item)
      throw new NotFoundAppException('CART_ITEM_NOT_FOUND', 'این کالا در سبد شما نیست');
    if (quantity <= 0) {
      await this.prisma.cartItem.delete({ where: { id: itemId } });
    } else {
      const available = this.availableOf(item.variant.inventory);
      const capped = Math.min(quantity, CART_MAX_LINE_QUANTITY, available);
      if (capped <= 0)
        throw new UnprocessableAppException('OUT_OF_STOCK', 'موجودی این کالا به پایان رسیده است');
      await this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity: capped } });
    }
    await this.touch(cart.id);
    return this.get(owner);
  }

  async removeItem(owner: CartOwner, itemId: string): Promise<CartView> {
    const cart = await this.findCart(owner, false);
    const item = cart?.items.find((i) => i.id === itemId);
    if (!cart || !item)
      throw new NotFoundAppException('CART_ITEM_NOT_FOUND', 'این کالا در سبد شما نیست');
    await this.prisma.cartItem.delete({ where: { id: itemId } });
    await this.touch(cart.id);
    return this.get(owner);
  }

  async clear(owner: CartOwner): Promise<CartView> {
    const cart = await this.findCart(owner, false);
    if (cart) {
      await this.prisma.$transaction([
        this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } }),
        this.prisma.cart.update({ where: { id: cart.id }, data: { couponCode: null } }),
      ]);
    }
    return this.emptyView(cart?.id);
  }

  async applyCoupon(owner: CartOwner, code: string): Promise<CartView> {
    const cart = (await this.findCart(owner, true))!;
    const resolution = await this.coupons.resolve(code, owner.userId ?? null);
    if (!resolution.ok) {
      throw new UnprocessableAppException(resolution.reason, COUPON_MESSAGES[resolution.reason]);
    }
    const subtotal = this.pricing.subtotal(
      cart.items.map((i) => ({ unitPrice: money(i.variant.price), quantity: i.quantity })),
    );
    if (resolution.rule.minCartAmount !== null && subtotal < resolution.rule.minCartAmount) {
      throw new UnprocessableAppException(
        'COUPON_MIN_CART',
        'مبلغ سبد خرید برای استفاده از این کد تخفیف کافی نیست',
      );
    }
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { couponCode: resolution.coupon.code },
    });
    return this.get(owner);
  }

  async removeCoupon(owner: CartOwner): Promise<CartView> {
    const cart = await this.findCart(owner, false);
    if (cart) await this.prisma.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
    return this.get(owner);
  }

  /**
   * Moves a guest cart into the user's cart after login/registration.
   * Quantities are summed (capped) and the guest cart is marked MERGED.
   */
  async mergeGuestCart(userId: string, token: string): Promise<void> {
    const guest = await this.prisma.cart.findFirst({
      where: { sessionHash: hashCartToken(token), status: 'ACTIVE', userId: null },
      include: cartInclude,
    });
    if (!guest) return;
    const target = (await this.findCart({ userId }, true))!;
    await this.prisma.$transaction(async (tx) => {
      for (const item of guest.items) {
        const existing = target.items.find((i) => i.variantId === item.variantId);
        const available = this.availableOf(item.variant.inventory);
        const quantity = Math.min(
          (existing?.quantity ?? 0) + item.quantity,
          CART_MAX_LINE_QUANTITY,
          Math.max(available, 0),
        );
        if (quantity <= 0) continue;
        if (existing) {
          await tx.cartItem.update({ where: { id: existing.id }, data: { quantity } });
        } else if (target.items.length < CART_MAX_LINES) {
          await tx.cartItem.create({
            data: {
              cartId: target.id,
              variantId: item.variantId,
              quantity,
              priceAtAdd: item.priceAtAdd,
            },
          });
        }
      }
      if (guest.couponCode && !target.couponCode) {
        await tx.cart.update({ where: { id: target.id }, data: { couponCode: guest.couponCode } });
      }
      await tx.cart.update({ where: { id: guest.id }, data: { status: 'MERGED' } });
    });
    this.logger.log({ message: 'guest cart merged', userId, items: guest.items.length });
  }

  /** Marks the cart converted after an order was placed. */
  async markConverted(cartId: string, tx: Prisma.TransactionClient): Promise<void> {
    await tx.cartItem.deleteMany({ where: { cartId } });
    await tx.cart.update({
      where: { id: cartId },
      data: { status: 'CONVERTED', couponCode: null },
    });
  }

  /** Full validation used by checkout: current prices, availability, coupon. */
  async resolve(cart: CartRow, userId: string | null): Promise<ResolvedCart> {
    const warnings: CartWarning[] = [];
    const items = cart.items.map((item) => this.toItemView(item, warnings));

    let coupon: AppliedCoupon | null = null;
    let couponRule: CouponRule | null = null;
    if (cart.couponCode) {
      const resolution = await this.coupons.resolve(cart.couponCode, userId);
      if (resolution.ok) {
        couponRule = resolution.rule;
      } else {
        warnings.push({ code: 'COUPON_INVALID', message: COUPON_MESSAGES[resolution.reason] });
      }
    }

    const sellable = items.filter((i) => i.inStock && !i.quantityExceedsStock);
    const breakdown = this.pricing.breakdown(
      sellable.map((i) => ({ unitPrice: i.unitPrice, quantity: i.quantity })),
      couponRule,
    );
    if (couponRule) {
      if (couponRule.minCartAmount !== null && breakdown.subtotal < couponRule.minCartAmount) {
        warnings.push({
          code: 'COUPON_INVALID',
          message: 'مبلغ سبد خرید برای استفاده از این کد تخفیف کافی نیست',
        });
        couponRule = null;
      } else {
        coupon = {
          code: couponRule.code,
          type: couponRule.type,
          value: couponRule.value,
          discount: breakdown.discount,
          description: null,
        };
      }
    }
    const totals = couponRule
      ? breakdown
      : this.pricing.breakdown(
          sellable.map((i) => ({ unitPrice: i.unitPrice, quantity: i.quantity })),
          null,
        );

    return {
      row: cart,
      couponRule,
      view: {
        id: cart.id,
        items,
        coupon,
        totals: { ...totals, currency: 'IRR' },
        warnings,
        updatedAt: cart.updatedAt.toISOString(),
      },
    };
  }

  private toItemView(item: CartItemRow, warnings: CartWarning[]): CartView['items'][number] {
    const variant = item.variant;
    const unitPrice = money(variant.price);
    const priceAtAdd = money(item.priceAtAdd);
    const available = this.availableOf(variant.inventory);
    const sellable = variant.status === 'ACTIVE' && PUBLIC_STATUSES.has(variant.product.status);
    const inStock = sellable && available > 0;
    const exceeds = inStock && item.quantity > available;
    const image = variant.images[0] ?? variant.product.images[0] ?? null;
    const view = {
      id: item.id,
      variantId: variant.id,
      productId: variant.product.id,
      productTitle: variant.product.title,
      productSlug: variant.product.slug,
      variantTitle: variant.title,
      sku: variant.sku,
      image: image ? { url: image.url, alt: image.alt } : null,
      unitPrice,
      compareAtPrice: moneyOrNull(variant.compareAtPrice),
      priceAtAdd,
      priceChanged: unitPrice !== priceAtAdd,
      quantity: item.quantity,
      lineTotal: this.pricing.lineTotal({ unitPrice, quantity: item.quantity }),
      availableQuantity: available,
      inStock,
      quantityExceedsStock: exceeds,
    };
    if (!sellable)
      warnings.push({
        code: 'ITEM_UNAVAILABLE',
        itemId: item.id,
        message: `«${variant.product.title}» دیگر قابل فروش نیست`,
      });
    else if (!inStock)
      warnings.push({
        code: 'OUT_OF_STOCK',
        itemId: item.id,
        message: `«${variant.product.title}» ناموجود شده است`,
      });
    else if (exceeds)
      warnings.push({
        code: 'QUANTITY_REDUCED',
        itemId: item.id,
        message: `از «${variant.product.title}» فقط ${available} عدد موجود است`,
      });
    if (view.priceChanged && sellable)
      warnings.push({
        code: 'PRICE_CHANGED',
        itemId: item.id,
        message: `قیمت «${variant.product.title}» تغییر کرده است`,
      });
    return view;
  }

  private availableOf(
    inventory: { stockQuantity: number; reservedQuantity: number } | null,
  ): number {
    return inventory ? Math.max(0, inventory.stockQuantity - inventory.reservedQuantity) : 0;
  }

  private async touch(cartId: string): Promise<void> {
    await this.prisma.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });
  }

  private emptyView(id = ''): CartView {
    return {
      id,
      items: [],
      coupon: null,
      totals: { subtotal: 0, discount: 0, total: 0, itemCount: 0, currency: 'IRR' },
      warnings: [],
      updatedAt: new Date().toISOString(),
    };
  }
}
