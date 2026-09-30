import { Injectable } from '@nestjs/common';
import { buildPagination, type Paginated, type ProductCard, type ProductDetail } from '@pe/shared';
import { CategoriesService } from '../categories/categories.service.js';
import {
  ConflictAppException,
  NotFoundAppException,
  UnprocessableAppException,
} from '../common/errors/app.exception.js';
import { resolveUniqueSlug } from '../common/utils/slug.util.js';
import type { Prisma, ProductStatus } from '../generated/prisma/client.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AdminProductsQueryDto,
  CreateProductDto,
  CreateVariantDto,
  ProductAttributeInputDto,
  ProductImageInputDto,
  ProductSpecificationInputDto,
  UpdateProductDto,
  UpdateProductImageDto,
  UpdateVariantDto,
  VariantAttributeInputDto,
} from './dto/product.dto.js';
import {
  productCardInclude,
  productDetailInclude,
  toProductCard,
  toProductDetail,
} from './products.mapper.js';

type Tx = Prisma.TransactionClient;

/**
 * Administrative catalogue writes. Every mutation keeps the denormalised
 * price range (`minPrice`/`maxPrice`) in sync and validates referential
 * consistency (attribute types, variant uniqueness, image ownership).
 */
@Injectable()
export class ProductsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
    private readonly inventory: InventoryService,
  ) {}

  async list(query: AdminProductsQueryDto): Promise<Paginated<ProductCard>> {
    const where: Prisma.ProductWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.brandId) where.brandId = query.brandId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { titleEn: { contains: query.search } },
        { slug: { contains: query.search } },
        { variants: { some: { sku: { contains: query.search } } } },
      ];
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: productCardInclude,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
    ]);
    return {
      items: rows.map(toProductCard),
      pagination: buildPagination(query.page, query.limit, total),
    };
  }

  async get(id: string): Promise<ProductDetail> {
    const row = await this.prisma.product.findUnique({
      where: { id },
      include: productDetailInclude,
    });
    if (!row) throw new NotFoundAppException('PRODUCT_NOT_FOUND', 'محصول پیدا نشد');
    const breadcrumb = await this.categories.breadcrumbFor(row.category);
    return toProductDetail(row, breadcrumb, { includeInactiveVariants: true });
  }

  async create(dto: CreateProductDto): Promise<ProductDetail> {
    await this.assertCategory(dto.categoryId);
    if (dto.brandId) await this.assertBrand(dto.brandId);
    await this.assertUniqueSkus(dto.variants.map((v) => v.sku));
    this.assertSingleDefault(dto.variants);
    const slug = await resolveUniqueSlug(dto.slug, dto.titleEn ?? dto.title, (s) =>
      this.slugExists(s),
    );
    const { attributes, specifications, variants, images, ...rest } = dto;

    const productId = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...rest,
          slug,
          publishedAt: rest.status === 'ACTIVE' ? new Date() : null,
        },
        select: { id: true },
      });
      if (attributes) await this.replaceAttributes(tx, product.id, attributes);
      if (specifications) await this.replaceSpecifications(tx, product.id, specifications);
      const skuToId = new Map<string, string>();
      for (const [index, variant] of variants.entries()) {
        const id = await this.insertVariant(tx, product.id, variant, index, variants.length === 1);
        skuToId.set(variant.sku, id);
      }
      if (images) {
        for (const [index, image] of images.entries()) {
          await tx.productImage.create({
            data: {
              productId: product.id,
              url: image.url,
              alt: image.alt,
              sortOrder: image.sortOrder ?? index,
              isPrimary: image.isPrimary ?? index === 0,
              variantId: image.variantId ?? null,
            },
          });
        }
      }
      await this.recalculatePriceRange(tx, product.id);
      return product.id;
    });
    return this.get(productId);
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductDetail> {
    const current = await this.requireProduct(id);
    if (dto.categoryId) await this.assertCategory(dto.categoryId);
    if (dto.brandId) await this.assertBrand(dto.brandId);
    const { attributes, specifications, slug: explicitSlug, ...rest } = dto;
    const data: Prisma.ProductUncheckedUpdateInput = { ...rest };
    if (explicitSlug !== undefined && explicitSlug !== current.slug) {
      data.slug = await resolveUniqueSlug(explicitSlug, dto.title ?? current.title, (s) =>
        this.slugExists(s, id),
      );
    }
    if (dto.status === 'ACTIVE' && !current.publishedAt) data.publishedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data });
      if (attributes) await this.replaceAttributes(tx, id, attributes);
      if (specifications) await this.replaceSpecifications(tx, id, specifications);
    });
    return this.get(id);
  }

  async setStatus(id: string, status: ProductStatus): Promise<ProductDetail> {
    const current = await this.requireProduct(id);
    if (status === 'ACTIVE') {
      const activeVariants = await this.prisma.productVariant.count({
        where: { productId: id, status: 'ACTIVE' },
      });
      if (activeVariants === 0) {
        throw new UnprocessableAppException(
          'PRODUCT_NO_ACTIVE_VARIANT',
          'برای انتشار محصول حداقل یک تنوع فعال لازم است',
        );
      }
    }
    await this.prisma.product.update({
      where: { id },
      data: {
        status,
        publishedAt: status === 'ACTIVE' && !current.publishedAt ? new Date() : undefined,
      },
    });
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    await this.requireProduct(id);
    // Products referenced by orders are archived, never deleted (enforced once orders exist).
    await this.prisma.product.delete({ where: { id } });
  }

  // --- variants ----------------------------------------------------------------

  async addVariant(productId: string, dto: CreateVariantDto): Promise<ProductDetail> {
    await this.requireProduct(productId);
    await this.assertUniqueSkus([dto.sku]);
    await this.prisma.$transaction(async (tx) => {
      const count = await tx.productVariant.count({ where: { productId } });
      if (dto.isDefault)
        await tx.productVariant.updateMany({ where: { productId }, data: { isDefault: false } });
      await this.insertVariant(tx, productId, dto, count, count === 0);
      await this.recalculatePriceRange(tx, productId);
    });
    return this.get(productId);
  }

  async updateVariant(variantId: string, dto: UpdateVariantDto): Promise<ProductDetail> {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) throw new NotFoundAppException('VARIANT_NOT_FOUND', 'تنوع محصول پیدا نشد');
    if (dto.sku && dto.sku !== variant.sku) await this.assertUniqueSkus([dto.sku], variantId);
    if (dto.barcode && dto.barcode !== variant.barcode) {
      const clash = await this.prisma.productVariant.findUnique({
        where: { barcode: dto.barcode },
        select: { id: true },
      });
      if (clash) throw new ConflictAppException('BARCODE_TAKEN', 'این بارکد قبلاً استفاده شده است');
    }
    const price = dto.price ?? Number(variant.price);
    const compareAt =
      dto.compareAtPrice === undefined
        ? variant.compareAtPrice === null
          ? null
          : Number(variant.compareAtPrice)
        : dto.compareAtPrice;
    this.assertPricing(price, compareAt);
    const { attributeValues, initialStock: _initialStock, lowStockThreshold, ...rest } = dto;

    await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.productVariant.updateMany({
          where: { productId: variant.productId },
          data: { isDefault: false },
        });
      }
      await tx.productVariant.update({
        where: { id: variantId },
        data: {
          ...rest,
          price: dto.price === undefined ? undefined : BigInt(dto.price),
          compareAtPrice:
            dto.compareAtPrice === undefined
              ? undefined
              : dto.compareAtPrice === null
                ? null
                : BigInt(dto.compareAtPrice),
        },
      });
      if (attributeValues) {
        await this.validateVariantAttributes(tx, attributeValues);
        await tx.variantAttributeValue.deleteMany({ where: { variantId } });
        await tx.variantAttributeValue.createMany({
          data: attributeValues.map((av) => ({
            variantId,
            attributeId: av.attributeId,
            valueId: av.valueId,
          })),
        });
      }
      if (lowStockThreshold !== undefined)
        await this.inventory.ensure(tx, variantId, lowStockThreshold);
      await this.recalculatePriceRange(tx, variant.productId);
    });
    return this.get(variant.productId);
  }

  async removeVariant(variantId: string): Promise<ProductDetail> {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) throw new NotFoundAppException('VARIANT_NOT_FOUND', 'تنوع محصول پیدا نشد');
    await this.prisma.$transaction(async (tx) => {
      const remaining = await tx.productVariant.count({ where: { productId: variant.productId } });
      if (remaining <= 1) {
        throw new UnprocessableAppException(
          'LAST_VARIANT',
          'هر محصول باید حداقل یک تنوع داشته باشد',
        );
      }
      await tx.productVariant.delete({ where: { id: variantId } });
      if (variant.isDefault) {
        const next = await tx.productVariant.findFirst({
          where: { productId: variant.productId },
          orderBy: { sortOrder: 'asc' },
        });
        if (next)
          await tx.productVariant.update({ where: { id: next.id }, data: { isDefault: true } });
      }
      await this.recalculatePriceRange(tx, variant.productId);
    });
    return this.get(variant.productId);
  }

  // --- images ------------------------------------------------------------------

  async addImage(productId: string, dto: ProductImageInputDto): Promise<ProductDetail> {
    await this.requireProduct(productId);
    if (dto.variantId) await this.assertVariantBelongs(productId, dto.variantId);
    await this.prisma.$transaction(async (tx) => {
      const count = await tx.productImage.count({ where: { productId } });
      if (dto.isPrimary)
        await tx.productImage.updateMany({ where: { productId }, data: { isPrimary: false } });
      await tx.productImage.create({
        data: {
          productId,
          url: dto.url,
          alt: dto.alt,
          sortOrder: dto.sortOrder ?? count,
          isPrimary: dto.isPrimary ?? count === 0,
          variantId: dto.variantId ?? null,
        },
      });
    });
    return this.get(productId);
  }

  async updateImage(imageId: string, dto: UpdateProductImageDto): Promise<ProductDetail> {
    const image = await this.prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image) throw new NotFoundAppException('IMAGE_NOT_FOUND', 'تصویر پیدا نشد');
    if (dto.variantId) await this.assertVariantBelongs(image.productId, dto.variantId);
    await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary)
        await tx.productImage.updateMany({
          where: { productId: image.productId },
          data: { isPrimary: false },
        });
      await tx.productImage.update({
        where: { id: imageId },
        data: { ...dto, variantId: dto.variantId === undefined ? undefined : dto.variantId },
      });
    });
    return this.get(image.productId);
  }

  async reorderImages(productId: string, imageIds: string[]): Promise<ProductDetail> {
    await this.requireProduct(productId);
    const images = await this.prisma.productImage.findMany({
      where: { productId },
      select: { id: true },
    });
    const owned = new Set(images.map((i) => i.id));
    if (imageIds.some((id) => !owned.has(id))) {
      throw new UnprocessableAppException(
        'IMAGE_NOT_OWNED',
        'یکی از تصاویر متعلق به این محصول نیست',
      );
    }
    await this.prisma.$transaction(
      imageIds.map((id, index) =>
        this.prisma.productImage.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
    return this.get(productId);
  }

  async removeImage(imageId: string): Promise<ProductDetail> {
    const image = await this.prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image) throw new NotFoundAppException('IMAGE_NOT_FOUND', 'تصویر پیدا نشد');
    await this.prisma.$transaction(async (tx) => {
      await tx.productImage.delete({ where: { id: imageId } });
      if (image.isPrimary) {
        const next = await tx.productImage.findFirst({
          where: { productId: image.productId },
          orderBy: { sortOrder: 'asc' },
        });
        if (next)
          await tx.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
      }
    });
    return this.get(image.productId);
  }

  // --- internals ---------------------------------------------------------------

  private async insertVariant(
    tx: Tx,
    productId: string,
    dto: CreateVariantDto,
    index: number,
    forceDefault: boolean,
  ): Promise<string> {
    this.assertPricing(dto.price, dto.compareAtPrice ?? null);
    if (dto.barcode) {
      const clash = await tx.productVariant.findUnique({
        where: { barcode: dto.barcode },
        select: { id: true },
      });
      if (clash) throw new ConflictAppException('BARCODE_TAKEN', `بارکد تکراری: ${dto.barcode}`);
    }
    const { attributeValues, initialStock, lowStockThreshold, ...rest } = dto;
    if (attributeValues) await this.validateVariantAttributes(tx, attributeValues);
    const variant = await tx.productVariant.create({
      data: {
        ...rest,
        productId,
        price: BigInt(dto.price),
        compareAtPrice:
          dto.compareAtPrice === undefined || dto.compareAtPrice === null
            ? null
            : BigInt(dto.compareAtPrice),
        isDefault: forceDefault || (dto.isDefault ?? false),
        sortOrder: dto.sortOrder ?? index,
        attributeValues: attributeValues
          ? {
              create: attributeValues.map((av) => ({
                attributeId: av.attributeId,
                valueId: av.valueId,
              })),
            }
          : undefined,
      },
      select: { id: true },
    });
    await this.inventory.ensure(tx, variant.id, lowStockThreshold);
    if (initialStock && initialStock > 0) {
      await tx.inventory.update({
        where: { variantId: variant.id },
        data: { stockQuantity: initialStock },
      });
      await tx.inventoryTransaction.create({
        data: {
          variantId: variant.id,
          type: 'PURCHASE',
          quantity: initialStock,
          stockAfter: initialStock,
          reservedAfter: 0,
          note: 'موجودی اولیه',
        },
      });
    }
    return variant.id;
  }

  private async replaceAttributes(
    tx: Tx,
    productId: string,
    attributes: ProductAttributeInputDto[],
  ): Promise<void> {
    const ids = [...new Set(attributes.map((a) => a.attributeId))];
    if (ids.length !== attributes.length) {
      throw new UnprocessableAppException(
        'ATTRIBUTE_DUPLICATE',
        'هر ویژگی فقط یک بار می‌تواند تعیین شود',
      );
    }
    const defs = await tx.attribute.findMany({
      where: { id: { in: ids } },
      include: { values: { select: { id: true } } },
    });
    if (defs.length !== ids.length)
      throw new NotFoundAppException('ATTRIBUTE_NOT_FOUND', 'ویژگی پیدا نشد');
    const byId = new Map(defs.map((d) => [d.id, d]));
    for (const input of attributes) {
      const def = byId.get(input.attributeId)!;
      if (def.type === 'SELECT') {
        if (!input.valueId || !def.values.some((v) => v.id === input.valueId)) {
          throw new UnprocessableAppException(
            'ATTRIBUTE_VALUE_INVALID',
            `مقدار ویژگی «${def.name}» معتبر نیست`,
          );
        }
      } else if (!input.valueText) {
        throw new UnprocessableAppException(
          'ATTRIBUTE_VALUE_INVALID',
          `برای ویژگی «${def.name}» مقدار متنی لازم است`,
        );
      }
    }
    await tx.productAttributeValue.deleteMany({ where: { productId } });
    await tx.productAttributeValue.createMany({
      data: attributes.map((a) => ({
        productId,
        attributeId: a.attributeId,
        valueId: a.valueId ?? null,
        valueText: a.valueText ?? null,
      })),
    });
  }

  private async replaceSpecifications(
    tx: Tx,
    productId: string,
    specs: ProductSpecificationInputDto[],
  ): Promise<void> {
    await tx.productSpecification.deleteMany({ where: { productId } });
    if (specs.length > 0) {
      await tx.productSpecification.createMany({
        data: specs.map((s, index) => ({
          productId,
          group: s.group,
          name: s.name,
          value: s.value,
          sortOrder: s.sortOrder ?? index,
        })),
      });
    }
  }

  private async validateVariantAttributes(
    tx: Tx,
    values: VariantAttributeInputDto[],
  ): Promise<void> {
    const seen = new Set<string>();
    for (const v of values) {
      if (seen.has(v.attributeId))
        throw new UnprocessableAppException('ATTRIBUTE_DUPLICATE', 'ویژگی تکراری در تنوع');
      seen.add(v.attributeId);
    }
    const found = await tx.attributeValue.findMany({
      where: { OR: values.map((v) => ({ id: v.valueId, attributeId: v.attributeId })) },
      include: { attribute: { select: { isVariant: true, name: true } } },
    });
    if (found.length !== values.length) {
      throw new UnprocessableAppException('ATTRIBUTE_VALUE_INVALID', 'مقدار ویژگی تنوع معتبر نیست');
    }
    const nonVariant = found.find((f) => !f.attribute.isVariant);
    if (nonVariant) {
      throw new UnprocessableAppException(
        'ATTRIBUTE_NOT_VARIANT',
        `ویژگی «${nonVariant.attribute.name}» تنوع‌ساز نیست`,
      );
    }
  }

  /** Keeps `minPrice`/`maxPrice` in sync with the active variants. */
  async recalculatePriceRange(tx: Tx, productId: string): Promise<void> {
    const agg = await tx.productVariant.aggregate({
      where: { productId, status: 'ACTIVE' },
      _min: { price: true },
      _max: { price: true },
    });
    await tx.product.update({
      where: { id: productId },
      data: { minPrice: agg._min.price, maxPrice: agg._max.price },
    });
  }

  private assertPricing(price: number, compareAt: number | null): void {
    if (compareAt !== null && compareAt <= price) {
      throw new UnprocessableAppException(
        'COMPARE_AT_PRICE_INVALID',
        'قیمت قبل از تخفیف باید از قیمت فروش بیشتر باشد',
      );
    }
  }

  private assertSingleDefault(variants: CreateVariantDto[]): void {
    if (variants.filter((v) => v.isDefault).length > 1) {
      throw new UnprocessableAppException(
        'MULTIPLE_DEFAULT_VARIANTS',
        'فقط یک تنوع می‌تواند پیش‌فرض باشد',
      );
    }
    const skus = new Set<string>();
    for (const v of variants) {
      if (skus.has(v.sku))
        throw new UnprocessableAppException('SKU_DUPLICATE', `SKU تکراری: ${v.sku}`);
      skus.add(v.sku);
    }
  }

  private async assertUniqueSkus(skus: string[], exceptVariantId?: string): Promise<void> {
    const clashes = await this.prisma.productVariant.findMany({
      where: { sku: { in: skus } },
      select: { id: true, sku: true },
    });
    const clash = clashes.find((c) => c.id !== exceptVariantId);
    if (clash)
      throw new ConflictAppException('SKU_TAKEN', `SKU قبلاً استفاده شده است: ${clash.sku}`);
  }

  private async assertCategory(id: string): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { id }, select: { id: true } });
    if (!category) throw new NotFoundAppException('CATEGORY_NOT_FOUND', 'دسته‌بندی پیدا نشد');
  }

  private async assertBrand(id: string): Promise<void> {
    const brand = await this.prisma.brand.findUnique({ where: { id }, select: { id: true } });
    if (!brand) throw new NotFoundAppException('BRAND_NOT_FOUND', 'برند پیدا نشد');
  }

  private async assertVariantBelongs(productId: string, variantId: string): Promise<void> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
      select: { id: true },
    });
    if (!variant)
      throw new UnprocessableAppException('VARIANT_NOT_OWNED', 'تنوع متعلق به این محصول نیست');
  }

  private async requireProduct(
    id: string,
  ): Promise<{ id: string; slug: string; title: string; publishedAt: Date | null }> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, slug: true, title: true, publishedAt: true },
    });
    if (!product) throw new NotFoundAppException('PRODUCT_NOT_FOUND', 'محصول پیدا نشد');
    return product;
  }

  private async slugExists(slug: string, exceptId?: string): Promise<boolean> {
    const found = await this.prisma.product.findUnique({ where: { slug }, select: { id: true } });
    return found !== null && found.id !== exceptId;
  }
}
