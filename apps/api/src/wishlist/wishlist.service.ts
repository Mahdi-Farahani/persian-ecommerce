import { Injectable } from '@nestjs/common';
import {
  PUBLIC_PRODUCT_STATUSES,
  WISHLIST_MAX_ITEMS,
  type CartView,
  type WishlistView,
} from '@pe/shared';
import { CartService } from '../cart/cart.service.js';
import { NotFoundAppException, UnprocessableAppException } from '../common/errors/app.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { productCardInclude, toProductCard } from '../products/products.mapper.js';

/** Per-user wishlist of products (not variants); idempotent add/remove. */
@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
  ) {}

  async list(userId: string): Promise<WishlistView> {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { userId, product: { status: { in: [...PUBLIC_PRODUCT_STATUSES] } } },
      include: { product: { include: productCardInclude } },
      orderBy: { createdAt: 'desc' },
    });
    return {
      items: rows.map((row) => ({
        productId: row.productId,
        addedAt: row.createdAt.toISOString(),
        product: toProductCard(row.product),
      })),
      count: rows.length,
    };
  }

  /** Product ids only, for rendering heart states across listings. */
  async ids(userId: string): Promise<string[]> {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { userId },
      select: { productId: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => r.productId);
  }

  async add(userId: string, productId: string): Promise<WishlistView> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: { in: [...PUBLIC_PRODUCT_STATUSES] } },
      select: { id: true },
    });
    if (!product) throw new NotFoundAppException('PRODUCT_NOT_FOUND', 'محصول پیدا نشد');
    const count = await this.prisma.wishlistItem.count({ where: { userId } });
    const exists = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (!exists) {
      if (count >= WISHLIST_MAX_ITEMS) {
        throw new UnprocessableAppException(
          'WISHLIST_FULL',
          `فهرست علاقه‌مندی‌ها حداکثر ${WISHLIST_MAX_ITEMS} کالا می‌پذیرد`,
        );
      }
      await this.prisma.wishlistItem.create({ data: { userId, productId } });
    }
    return this.list(userId);
  }

  async remove(userId: string, productId: string): Promise<WishlistView> {
    await this.prisma.wishlistItem.deleteMany({ where: { userId, productId } });
    return this.list(userId);
  }

  /**
   * Adds the product's default (or first purchasable) variant to the cart and
   * removes it from the wishlist. Stock is validated by the cart.
   */
  async moveToCart(
    userId: string,
    productId: string,
  ): Promise<{ cart: CartView; wishlist: WishlistView }> {
    const item = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
      include: {
        product: {
          include: {
            variants: {
              where: { status: 'ACTIVE' },
              include: { inventory: true },
              orderBy: [{ isDefault: 'desc' }, { price: 'asc' }],
            },
          },
        },
      },
    });
    if (!item)
      throw new NotFoundAppException('WISHLIST_ITEM_NOT_FOUND', 'این کالا در علاقه‌مندی‌ها نیست');
    const variants = item.product.variants;
    const purchasable =
      variants.find(
        (v) => (v.inventory?.stockQuantity ?? 0) - (v.inventory?.reservedQuantity ?? 0) > 0,
      ) ?? variants[0];
    if (!purchasable) {
      throw new UnprocessableAppException(
        'PRODUCT_UNAVAILABLE',
        'این کالا در حال حاضر قابل خرید نیست',
      );
    }
    const cart = await this.cart.addItem({ userId }, purchasable.id, 1);
    const wishlist = await this.remove(userId, productId);
    return { cart, wishlist };
  }
}
