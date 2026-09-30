import { Injectable } from '@nestjs/common';
import { buildPagination, type BrandDetail, type BrandSummary, type Paginated } from '@pe/shared';
import { ConflictAppException, NotFoundAppException } from '../common/errors/app.exception.js';
import { resolveUniqueSlug } from '../common/utils/slug.util.js';
import type { Brand, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminBrandsQueryDto, CreateBrandDto, UpdateBrandDto } from './dto/brand.dto.js';

type BrandWithCount = Brand & { _count: { products: number } };

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  static toSummary(brand: Brand): BrandSummary {
    return {
      id: brand.id,
      name: brand.name,
      nameEn: brand.nameEn,
      slug: brand.slug,
      logoUrl: brand.logoUrl,
    };
  }

  static toDetail(brand: BrandWithCount): BrandDetail {
    return {
      ...BrandsService.toSummary(brand),
      description: brand.description,
      isActive: brand.isActive,
      sortOrder: brand.sortOrder,
      seoTitle: brand.seoTitle,
      seoDescription: brand.seoDescription,
      productCount: brand._count.products,
    };
  }

  /** Active brands for storefront navigation. */
  async listPublic(): Promise<BrandSummary[]> {
    const brands = await this.prisma.brand.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return brands.map((b) => BrandsService.toSummary(b));
  }

  async getPublicBySlug(slug: string): Promise<BrandDetail> {
    const brand = await this.prisma.brand.findFirst({
      where: { slug, isActive: true },
      include: {
        _count: { select: { products: { where: { status: { in: ['ACTIVE', 'OUT_OF_STOCK'] } } } } },
      },
    });
    if (!brand) throw new NotFoundAppException('BRAND_NOT_FOUND', 'برند پیدا نشد');
    return BrandsService.toDetail(brand);
  }

  async adminList(query: AdminBrandsQueryDto): Promise<Paginated<BrandDetail>> {
    const where: Prisma.BrandWhereInput = {};
    if (!query.includeInactive) where.isActive = true;
    if (query.search) {
      where.OR = [{ name: { contains: query.search } }, { nameEn: { contains: query.search } }];
    }
    const [total, brands] = await this.prisma.$transaction([
      this.prisma.brand.count({ where }),
      this.prisma.brand.findMany({
        where,
        include: { _count: { select: { products: true } } },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: query.skip,
        take: query.limit,
      }),
    ]);
    return {
      items: brands.map((b) => BrandsService.toDetail(b)),
      pagination: buildPagination(query.page, query.limit, total),
    };
  }

  async adminGet(id: string): Promise<BrandDetail> {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!brand) throw new NotFoundAppException('BRAND_NOT_FOUND', 'برند پیدا نشد');
    return BrandsService.toDetail(brand);
  }

  async create(dto: CreateBrandDto): Promise<BrandDetail> {
    const existingName = await this.prisma.brand.findUnique({
      where: { name: dto.name },
      select: { id: true },
    });
    if (existingName)
      throw new ConflictAppException('BRAND_NAME_TAKEN', 'برندی با این نام وجود دارد');
    const slug = await resolveUniqueSlug(dto.slug, dto.nameEn ?? dto.name, (s) =>
      this.slugExists(s),
    );
    const brand = await this.prisma.brand.create({
      data: { ...dto, slug },
      include: { _count: { select: { products: true } } },
    });
    return BrandsService.toDetail(brand);
  }

  async update(id: string, dto: UpdateBrandDto): Promise<BrandDetail> {
    const current = await this.prisma.brand.findUnique({ where: { id } });
    if (!current) throw new NotFoundAppException('BRAND_NOT_FOUND', 'برند پیدا نشد');
    if (dto.name && dto.name !== current.name) {
      const clash = await this.prisma.brand.findUnique({
        where: { name: dto.name },
        select: { id: true },
      });
      if (clash) throw new ConflictAppException('BRAND_NAME_TAKEN', 'برندی با این نام وجود دارد');
    }
    const slug =
      dto.slug !== undefined && dto.slug !== current.slug
        ? await resolveUniqueSlug(dto.slug, dto.name ?? current.name, (s) => this.slugExists(s, id))
        : undefined;
    const brand = await this.prisma.brand.update({
      where: { id },
      data: { ...dto, ...(slug ? { slug } : {}) },
      include: { _count: { select: { products: true } } },
    });
    return BrandsService.toDetail(brand);
  }

  async remove(id: string): Promise<void> {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!brand) throw new NotFoundAppException('BRAND_NOT_FOUND', 'برند پیدا نشد');
    if (brand._count.products > 0) {
      throw new ConflictAppException(
        'BRAND_IN_USE',
        'این برند دارای محصول است و قابل حذف نیست؛ آن را غیرفعال کنید',
      );
    }
    await this.prisma.brand.delete({ where: { id } });
  }

  private async slugExists(slug: string, exceptId?: string): Promise<boolean> {
    const found = await this.prisma.brand.findUnique({ where: { slug }, select: { id: true } });
    return found !== null && found.id !== exceptId;
  }
}
