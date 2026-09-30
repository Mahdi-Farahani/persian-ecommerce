import { Injectable } from '@nestjs/common';
import {
  buildPagination,
  type InventorySnapshot,
  type InventoryTransactionView,
  type Paginated,
  type ProductDetail,
  type SellerOfferView,
} from '@pe/shared';
import { NotFoundAppException } from '../common/errors/app.exception.js';
import { money, moneyOrNull } from '../common/utils/money.util.js';
import type { Prisma } from '../generated/prisma/client.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateProductDto } from '../products/dto/product.dto.js';
import { ProductsAdminService } from '../products/products-admin.service.js';
import type { CreateOfferDto, SellerAdjustStockDto, UpdateOfferDto } from './dto/seller.dto.js';

const offerInclude = {
  inventory: true,
  attributeValues: { include: { attribute: true, value: true } },
  product: {
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 },
    },
  },
} satisfies Prisma.ProductVariantInclude;
type OfferRow = Prisma.ProductVariantGetPayload<{ include: typeof offerInclude }>;

function toOffer(row: OfferRow): SellerOfferView {
  const stock = row.inventory?.stockQuantity ?? 0;
  const reserved = row.inventory?.reservedQuantity ?? 0;
  const available = Math.max(0, stock - reserved);
  return {
    variantId: row.id,
    productId: row.product.id,
    productTitle: row.product.title,
    productSlug: row.product.slug,
    productStatus: row.product.status,
    imageUrl: row.product.images[0]?.url ?? null,
    sku: row.sku,
    title: row.title,
    price: money(row.price),
    compareAtPrice: moneyOrNull(row.compareAtPrice),
    status: row.status,
    attributes: row.attributeValues.map((av) => ({
      attributeName: av.attribute.name,
      value: av.value.value,
    })),
    stockQuantity: stock,
    reservedQuantity: reserved,
    availableQuantity: available,
    lowStock: available <= (row.inventory?.lowStockThreshold ?? 0),
  };
}

/**
 * A seller's offers are product variants that carry their sellerId. Sellers
 * add offers to catalogue products or propose new products (created as
 * DRAFT for admin approval); every mutation is scoped to their own rows.
 */
@Injectable()
export class SellerCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsAdminService,
    private readonly inventory: InventoryService,
  ) {}

  async listOffers(
    sellerId: string,
    query: { page: number; limit: number; search?: string; lowStock?: boolean },
  ): Promise<Paginated<SellerOfferView>> {
    const where: Prisma.ProductVariantWhereInput = { sellerId };
    if (query.search) {
      where.OR = [
        { sku: { contains: query.search } },
        { product: { title: { contains: query.search } } },
      ];
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.productVariant.count({ where }),
      this.prisma.productVariant.findMany({
        where,
        include: offerInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    let items = rows.map(toOffer);
    if (query.lowStock) items = items.filter((o) => o.lowStock);
    return { items, pagination: buildPagination(query.page, query.limit, total) };
  }

  async createOffer(
    sellerId: string,
    productId: string,
    dto: CreateOfferDto,
  ): Promise<SellerOfferView> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: { in: ['ACTIVE', 'OUT_OF_STOCK', 'DRAFT'] } },
      select: { id: true },
    });
    if (!product) throw new NotFoundAppException('PRODUCT_NOT_FOUND', 'محصول پیدا نشد');
    const detail = await this.products.addVariant(
      productId,
      { ...dto, isDefault: false, status: 'ACTIVE' },
      { sellerId },
    );
    const created = detail.variants.find((v) => v.sku === dto.sku);
    return this.requireOffer(sellerId, created!.id);
  }

  /** Sellers may propose a catalogue product; it stays DRAFT until an admin publishes it. */
  async proposeProduct(sellerId: string, dto: CreateProductDto): Promise<ProductDetail> {
    return this.products.create({ ...dto, status: 'DRAFT' }, { sellerId });
  }

  async updateOffer(
    sellerId: string,
    variantId: string,
    dto: UpdateOfferDto,
  ): Promise<SellerOfferView> {
    await this.requireOffer(sellerId, variantId);
    await this.products.updateVariant(variantId, dto);
    return this.requireOffer(sellerId, variantId);
  }

  async removeOffer(sellerId: string, variantId: string): Promise<void> {
    await this.requireOffer(sellerId, variantId);
    await this.products.removeVariant(variantId);
  }

  async adjustStock(
    sellerId: string,
    variantId: string,
    dto: SellerAdjustStockDto,
    actorId: string,
  ): Promise<InventorySnapshot> {
    await this.requireOffer(sellerId, variantId);
    return this.inventory.adjustStock({
      variantId,
      quantity: dto.quantity,
      type: dto.quantity > 0 ? 'PURCHASE' : 'ADJUSTMENT',
      note: dto.note,
      actorId,
      referenceType: 'seller',
      referenceId: sellerId,
    });
  }

  async transactions(sellerId: string, variantId: string): Promise<InventoryTransactionView[]> {
    await this.requireOffer(sellerId, variantId);
    return this.inventory.transactions(variantId);
  }

  async requireOffer(sellerId: string, variantId: string): Promise<SellerOfferView> {
    const row = await this.prisma.productVariant.findFirst({
      where: { id: variantId, sellerId },
      include: offerInclude,
    });
    if (!row) throw new NotFoundAppException('OFFER_NOT_FOUND', 'این پیشنهاد متعلق به شما نیست');
    return toOffer(row);
  }
}
