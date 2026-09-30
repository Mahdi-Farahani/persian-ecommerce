import { Injectable } from '@nestjs/common';
import type {
  CategoryDetail,
  CategoryNode,
  CategorySummary,
  FilterableAttribute,
} from '@pe/shared';
import {
  ConflictAppException,
  NotFoundAppException,
  UnprocessableAppException,
} from '../common/errors/app.exception.js';
import { resolveUniqueSlug } from '../common/utils/slug.util.js';
import type { Category, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';

const MAX_DEPTH = 6;

export interface AdminCategory extends CategorySummary {
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  path: string;
  productCount: number;
  attributes: Array<{
    attributeId: string;
    name: string;
    slug: string;
    isRequired: boolean;
    sortOrder: number;
  }>;
}

const adminInclude = {
  _count: { select: { products: true } },
  attributes: {
    include: { attribute: { select: { name: true, slug: true } } },
    orderBy: { sortOrder: 'asc' },
  },
} satisfies Prisma.CategoryInclude;

type AdminCategoryRow = Prisma.CategoryGetPayload<{ include: typeof adminInclude }>;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  static toSummary(category: Category): CategorySummary {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      imageUrl: category.imageUrl,
      parentId: category.parentId,
      depth: category.depth,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
    };
  }

  /** Builds the nested tree from a flat list (already sorted by sortOrder/name). */
  static buildTree(categories: Category[]): CategoryNode[] {
    const nodes = new Map<string, CategoryNode>();
    for (const category of categories) {
      nodes.set(category.id, { ...CategoriesService.toSummary(category), children: [] });
    }
    const roots: CategoryNode[] = [];
    for (const category of categories) {
      const node = nodes.get(category.id)!;
      const parent = category.parentId ? nodes.get(category.parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  async tree(includeInactive = false): Promise<CategoryNode[]> {
    const categories = await this.prisma.category.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ depth: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    return CategoriesService.buildTree(categories);
  }

  async getPublicBySlug(slug: string): Promise<CategoryDetail> {
    const category = await this.prisma.category.findFirst({
      where: { slug, isActive: true },
      include: {
        children: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
      },
    });
    if (!category) throw new NotFoundAppException('CATEGORY_NOT_FOUND', 'دسته‌بندی پیدا نشد');
    const [breadcrumb, attributes] = await Promise.all([
      this.breadcrumbFor(category),
      this.filterableAttributes(category),
    ]);
    return {
      ...CategoriesService.toSummary(category),
      description: category.description,
      seoTitle: category.seoTitle,
      seoDescription: category.seoDescription,
      breadcrumb,
      children: category.children.map((c) => CategoriesService.toSummary(c)),
      attributes,
    };
  }

  /** Ancestors (root first) including the category itself. */
  async breadcrumbFor(
    category: Pick<Category, 'id' | 'name' | 'slug' | 'path'>,
  ): Promise<CategoryDetail['breadcrumb']> {
    const ancestorIds = category.path.split('/').filter(Boolean);
    if (ancestorIds.length === 0)
      return [{ id: category.id, name: category.name, slug: category.slug }];
    const ancestors = await this.prisma.category.findMany({
      where: { id: { in: ancestorIds } },
      select: { id: true, name: true, slug: true },
    });
    const byId = new Map(ancestors.map((a) => [a.id, a]));
    const ordered = ancestorIds
      .map((id) => byId.get(id))
      .filter((a): a is NonNullable<typeof a> => Boolean(a));
    return [...ordered, { id: category.id, name: category.name, slug: category.slug }];
  }

  /** Attributes attached to the category or any ancestor, with their values. */
  async filterableAttributes(
    category: Pick<Category, 'id' | 'path'>,
  ): Promise<FilterableAttribute[]> {
    const ids = [...category.path.split('/').filter(Boolean), category.id];
    const links = await this.prisma.categoryAttribute.findMany({
      where: { categoryId: { in: ids }, attribute: { isFilterable: true } },
      include: {
        attribute: { include: { values: { orderBy: [{ sortOrder: 'asc' }, { value: 'asc' }] } } },
      },
      orderBy: { sortOrder: 'asc' },
    });
    const seen = new Set<string>();
    const result: FilterableAttribute[] = [];
    for (const link of links) {
      if (seen.has(link.attributeId)) continue;
      seen.add(link.attributeId);
      const a = link.attribute;
      result.push({
        id: a.id,
        name: a.name,
        slug: a.slug,
        type: a.type,
        isVariant: a.isVariant,
        values: a.values.map((v) => ({
          id: v.id,
          value: v.value,
          slug: v.slug,
          colorHex: v.colorHex,
          sortOrder: v.sortOrder,
        })),
      });
    }
    return result;
  }

  /** Ids of the category and all its descendants (for listing filters). */
  async subtreeIds(categoryId: string): Promise<string[]> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, path: true },
    });
    if (!category) return [];
    const descendants = await this.prisma.category.findMany({
      where: { path: { startsWith: `${category.path}${category.id}/` } },
      select: { id: true },
    });
    return [category.id, ...descendants.map((d) => d.id)];
  }

  async findActiveBySlug(slug: string): Promise<Category | null> {
    return this.prisma.category.findFirst({ where: { slug, isActive: true } });
  }

  // --- administration -------------------------------------------------------

  async adminList(): Promise<AdminCategory[]> {
    const categories = await this.prisma.category.findMany({
      include: adminInclude,
      orderBy: [{ depth: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    return categories.map((c) => this.toAdmin(c));
  }

  async adminGet(id: string): Promise<AdminCategory> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: adminInclude,
    });
    if (!category) throw new NotFoundAppException('CATEGORY_NOT_FOUND', 'دسته‌بندی پیدا نشد');
    return this.toAdmin(category);
  }

  async create(dto: CreateCategoryDto): Promise<AdminCategory> {
    const parent = dto.parentId ? await this.requireCategory(dto.parentId) : null;
    if (parent && parent.depth + 1 > MAX_DEPTH) {
      throw new UnprocessableAppException(
        'CATEGORY_TOO_DEEP',
        `حداکثر عمق دسته‌بندی ${MAX_DEPTH} است`,
      );
    }
    const slug = await resolveUniqueSlug(dto.slug, dto.name, (s) => this.slugExists(s));
    const { attributes, parentId: _parentId, ...rest } = dto;
    const category = await this.prisma.category.create({
      data: {
        ...rest,
        slug,
        parentId: parent?.id ?? null,
        path: parent ? `${parent.path}${parent.id}/` : '/',
        depth: parent ? parent.depth + 1 : 0,
        attributes: attributes
          ? {
              create: attributes.map((a) => ({
                attributeId: a.attributeId,
                isRequired: a.isRequired ?? false,
                sortOrder: a.sortOrder ?? 0,
              })),
            }
          : undefined,
      },
      include: adminInclude,
    });
    return this.toAdmin(category);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<AdminCategory> {
    const current = await this.requireCategory(id);
    const { attributes, parentId, slug: explicitSlug, ...rest } = dto;
    const data: Prisma.CategoryUpdateInput = { ...rest };

    if (explicitSlug !== undefined && explicitSlug !== current.slug) {
      data.slug = await resolveUniqueSlug(explicitSlug, dto.name ?? current.name, (s) =>
        this.slugExists(s, id),
      );
    }

    let moveTo: Category | null | undefined;
    if (parentId !== undefined && parentId !== current.parentId) {
      moveTo = parentId ? await this.requireCategory(parentId) : null;
      if (moveTo && (moveTo.id === id || moveTo.path.includes(`/${id}/`))) {
        throw new UnprocessableAppException(
          'CATEGORY_CYCLE',
          'یک دسته نمی‌تواند زیرمجموعه خودش باشد',
        );
      }
    }

    const category = await this.prisma.$transaction(async (tx) => {
      if (moveTo !== undefined) {
        await this.moveSubtree(tx, current, moveTo);
      }
      if (attributes) {
        await tx.categoryAttribute.deleteMany({ where: { categoryId: id } });
        await tx.categoryAttribute.createMany({
          data: attributes.map((a) => ({
            categoryId: id,
            attributeId: a.attributeId,
            isRequired: a.isRequired ?? false,
            sortOrder: a.sortOrder ?? 0,
          })),
        });
      }
      return tx.category.update({ where: { id }, data, include: adminInclude });
    });
    return this.toAdmin(category);
  }

  async remove(id: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true, children: true } } },
    });
    if (!category) throw new NotFoundAppException('CATEGORY_NOT_FOUND', 'دسته‌بندی پیدا نشد');
    if (category._count.products > 0 || category._count.children > 0) {
      throw new ConflictAppException(
        'CATEGORY_IN_USE',
        'دسته‌بندی دارای محصول یا زیرمجموعه است و قابل حذف نیست',
      );
    }
    await this.prisma.category.delete({ where: { id } });
  }

  /** Re-parents a category and rewrites the materialised path of its subtree. */
  private async moveSubtree(
    tx: Prisma.TransactionClient,
    current: Category,
    newParent: Category | null,
  ): Promise<void> {
    const oldPrefix = `${current.path}${current.id}/`;
    const newPath = newParent ? `${newParent.path}${newParent.id}/` : '/';
    const newDepth = newParent ? newParent.depth + 1 : 0;
    const newPrefix = `${newPath}${current.id}/`;
    const descendants = await tx.category.findMany({ where: { path: { startsWith: oldPrefix } } });
    const depthDelta = newDepth - current.depth;
    if (descendants.some((d) => d.depth + depthDelta > MAX_DEPTH)) {
      throw new UnprocessableAppException(
        'CATEGORY_TOO_DEEP',
        `حداکثر عمق دسته‌بندی ${MAX_DEPTH} است`,
      );
    }
    await tx.category.update({
      where: { id: current.id },
      data: { parentId: newParent?.id ?? null, path: newPath, depth: newDepth },
    });
    for (const d of descendants) {
      await tx.category.update({
        where: { id: d.id },
        data: { path: d.path.replace(oldPrefix, newPrefix), depth: d.depth + depthDelta },
      });
    }
  }

  private async requireCategory(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundAppException('CATEGORY_NOT_FOUND', 'دسته‌بندی پیدا نشد');
    return category;
  }

  private async slugExists(slug: string, exceptId?: string): Promise<boolean> {
    const found = await this.prisma.category.findUnique({ where: { slug }, select: { id: true } });
    return found !== null && found.id !== exceptId;
  }

  private toAdmin(category: AdminCategoryRow): AdminCategory {
    return {
      ...CategoriesService.toSummary(category),
      description: category.description,
      seoTitle: category.seoTitle,
      seoDescription: category.seoDescription,
      path: category.path,
      productCount: category._count.products,
      attributes: category.attributes.map((a) => ({
        attributeId: a.attributeId,
        name: a.attribute.name,
        slug: a.attribute.slug,
        isRequired: a.isRequired,
        sortOrder: a.sortOrder,
      })),
    };
  }
}
