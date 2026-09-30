import { Injectable } from '@nestjs/common';
import { type AttributeSummary, slugify } from '@pe/shared';
import {
  ConflictAppException,
  NotFoundAppException,
  UnprocessableAppException,
} from '../common/errors/app.exception.js';
import { resolveUniqueSlug } from '../common/utils/slug.util.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AttributeValueInputDto,
  CreateAttributeDto,
  UpdateAttributeDto,
} from './dto/attribute.dto.js';

const withValues = {
  values: { orderBy: [{ sortOrder: 'asc' }, { value: 'asc' }] },
} satisfies Prisma.AttributeInclude;
type AttributeRow = Prisma.AttributeGetPayload<{ include: typeof withValues }>;

@Injectable()
export class AttributesService {
  constructor(private readonly prisma: PrismaService) {}

  static toSummary(attribute: AttributeRow): AttributeSummary {
    return {
      id: attribute.id,
      name: attribute.name,
      slug: attribute.slug,
      type: attribute.type,
      unit: attribute.unit,
      isVariant: attribute.isVariant,
      isFilterable: attribute.isFilterable,
      sortOrder: attribute.sortOrder,
      values: attribute.values.map((v) => ({
        id: v.id,
        value: v.value,
        slug: v.slug,
        colorHex: v.colorHex,
        sortOrder: v.sortOrder,
      })),
    };
  }

  async list(): Promise<AttributeSummary[]> {
    const attributes = await this.prisma.attribute.findMany({
      include: withValues,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return attributes.map((a) => AttributesService.toSummary(a));
  }

  async get(id: string): Promise<AttributeSummary> {
    const attribute = await this.prisma.attribute.findUnique({
      where: { id },
      include: withValues,
    });
    if (!attribute) throw new NotFoundAppException('ATTRIBUTE_NOT_FOUND', 'ویژگی پیدا نشد');
    return AttributesService.toSummary(attribute);
  }

  async create(dto: CreateAttributeDto): Promise<AttributeSummary> {
    const slug = await resolveUniqueSlug(dto.slug, dto.name, (s) => this.slugExists(s));
    const { values, ...rest } = dto;
    const attribute = await this.prisma.attribute.create({
      data: {
        ...rest,
        slug,
        values: values ? { create: this.prepareValues(values) } : undefined,
      },
      include: withValues,
    });
    return AttributesService.toSummary(attribute);
  }

  async update(id: string, dto: UpdateAttributeDto): Promise<AttributeSummary> {
    const current = await this.prisma.attribute.findUnique({ where: { id }, include: withValues });
    if (!current) throw new NotFoundAppException('ATTRIBUTE_NOT_FOUND', 'ویژگی پیدا نشد');
    const { values, slug: explicitSlug, ...rest } = dto;
    const data: Prisma.AttributeUpdateInput = { ...rest };
    if (explicitSlug !== undefined && explicitSlug !== current.slug) {
      data.slug = await resolveUniqueSlug(explicitSlug, dto.name ?? current.name, (s) =>
        this.slugExists(s, id),
      );
    }
    const attribute = await this.prisma.$transaction(async (tx) => {
      if (values) {
        const keepIds = new Set(values.filter((v) => v.id).map((v) => v.id as string));
        const removable = current.values.filter((v) => !keepIds.has(v.id));
        if (removable.length > 0) {
          const inUse = await tx.variantAttributeValue.count({
            where: { valueId: { in: removable.map((v) => v.id) } },
          });
          const inUseProducts = await tx.productAttributeValue.count({
            where: { valueId: { in: removable.map((v) => v.id) } },
          });
          if (inUse > 0 || inUseProducts > 0) {
            throw new ConflictAppException(
              'ATTRIBUTE_VALUE_IN_USE',
              'برخی مقادیر در محصولات استفاده شده‌اند و قابل حذف نیستند',
            );
          }
          await tx.attributeValue.deleteMany({ where: { id: { in: removable.map((v) => v.id) } } });
        }
        for (const value of this.prepareValues(values)) {
          if (value.id) {
            await tx.attributeValue.update({
              where: { id: value.id },
              data: {
                value: value.value,
                slug: value.slug,
                colorHex: value.colorHex,
                sortOrder: value.sortOrder,
              },
            });
          } else {
            await tx.attributeValue.create({ data: { ...value, attributeId: id } });
          }
        }
      }
      return tx.attribute.update({ where: { id }, data, include: withValues });
    });
    return AttributesService.toSummary(attribute);
  }

  async remove(id: string): Promise<void> {
    const attribute = await this.prisma.attribute.findUnique({
      where: { id },
      include: { _count: { select: { products: true, variants: true, categories: true } } },
    });
    if (!attribute) throw new NotFoundAppException('ATTRIBUTE_NOT_FOUND', 'ویژگی پیدا نشد');
    if (attribute._count.products > 0 || attribute._count.variants > 0) {
      throw new ConflictAppException(
        'ATTRIBUTE_IN_USE',
        'این ویژگی در محصولات استفاده شده است و قابل حذف نیست',
      );
    }
    await this.prisma.attribute.delete({ where: { id } });
  }

  private prepareValues(
    values: AttributeValueInputDto[],
  ): Array<{ id?: string; value: string; slug: string; colorHex?: string; sortOrder: number }> {
    const slugs = new Set<string>();
    return values.map((v, index) => {
      const slug = (v.slug ? v.slug.trim() : slugify(v.value)) || `value-${index + 1}`;
      if (slugs.has(slug)) {
        throw new UnprocessableAppException(
          'ATTRIBUTE_VALUE_DUPLICATE',
          `مقدار تکراری: ${v.value}`,
        );
      }
      slugs.add(slug);
      return {
        id: v.id,
        value: v.value,
        slug,
        colorHex: v.colorHex,
        sortOrder: v.sortOrder ?? index,
      };
    });
  }

  private async slugExists(slug: string, exceptId?: string): Promise<boolean> {
    const found = await this.prisma.attribute.findUnique({ where: { slug }, select: { id: true } });
    return found !== null && found.id !== exceptId;
  }
}
