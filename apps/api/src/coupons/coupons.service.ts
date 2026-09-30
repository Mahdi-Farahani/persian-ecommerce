import { Injectable } from '@nestjs/common';
import { buildPagination, type Paginated } from '@pe/shared';
import { ConflictAppException, NotFoundAppException } from '../common/errors/app.exception.js';
import { moneyOrNull } from '../common/utils/money.util.js';
import type { Coupon, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CouponRule } from '../pricing/pricing.service.js';
import type { AdminCouponsQueryDto, CreateCouponDto, UpdateCouponDto } from './dto/coupon.dto.js';

export interface CouponView {
  id: string;
  code: string;
  description: string | null;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  maxDiscountAmount: number | null;
  minCartAmount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usageLimitPerUser: number | null;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CouponRejection =
  | 'COUPON_NOT_FOUND'
  | 'COUPON_INACTIVE'
  | 'COUPON_NOT_STARTED'
  | 'COUPON_EXPIRED'
  | 'COUPON_USAGE_LIMIT'
  | 'COUPON_USER_LIMIT';

export const COUPON_MESSAGES: Record<CouponRejection, string> = {
  COUPON_NOT_FOUND: 'کد تخفیف نامعتبر است',
  COUPON_INACTIVE: 'این کد تخفیف غیرفعال است',
  COUPON_NOT_STARTED: 'زمان استفاده از این کد تخفیف هنوز نرسیده است',
  COUPON_EXPIRED: 'این کد تخفیف منقضی شده است',
  COUPON_USAGE_LIMIT: 'سقف استفاده از این کد تخفیف پر شده است',
  COUPON_USER_LIMIT: 'شما قبلاً از این کد تخفیف استفاده کرده‌اید',
};

export type CouponResolution =
  { ok: true; coupon: Coupon; rule: CouponRule } | { ok: false; reason: CouponRejection };

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  static normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  static toRule(coupon: Coupon): CouponRule {
    return {
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      maxDiscountAmount: moneyOrNull(coupon.maxDiscountAmount),
      minCartAmount: moneyOrNull(coupon.minCartAmount),
    };
  }

  static toView(coupon: Coupon): CouponView {
    return {
      id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      type: coupon.type,
      value: coupon.value,
      maxDiscountAmount: moneyOrNull(coupon.maxDiscountAmount),
      minCartAmount: moneyOrNull(coupon.minCartAmount),
      startsAt: coupon.startsAt?.toISOString() ?? null,
      endsAt: coupon.endsAt?.toISOString() ?? null,
      usageLimit: coupon.usageLimit,
      usageLimitPerUser: coupon.usageLimitPerUser,
      usedCount: coupon.usedCount,
      isActive: coupon.isActive,
      createdAt: coupon.createdAt.toISOString(),
      updatedAt: coupon.updatedAt.toISOString(),
    };
  }

  /**
   * Resolves a coupon for use by a (possibly anonymous) customer. Per-user
   * usage is counted from orders once they exist; the hook receives the
   * user id so the check can be extended without touching callers.
   */
  async resolve(
    code: string,
    userId: string | null,
    countUserUsage?: (couponId: string, userId: string) => Promise<number>,
  ): Promise<CouponResolution> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: CouponsService.normalizeCode(code) },
    });
    if (!coupon) return { ok: false, reason: 'COUPON_NOT_FOUND' };
    if (!coupon.isActive) return { ok: false, reason: 'COUPON_INACTIVE' };
    const now = Date.now();
    if (coupon.startsAt && coupon.startsAt.getTime() > now)
      return { ok: false, reason: 'COUPON_NOT_STARTED' };
    if (coupon.endsAt && coupon.endsAt.getTime() < now)
      return { ok: false, reason: 'COUPON_EXPIRED' };
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)
      return { ok: false, reason: 'COUPON_USAGE_LIMIT' };
    if (coupon.usageLimitPerUser !== null && userId && countUserUsage) {
      const used = await countUserUsage(coupon.id, userId);
      if (used >= coupon.usageLimitPerUser) return { ok: false, reason: 'COUPON_USER_LIMIT' };
    }
    return { ok: true, coupon, rule: CouponsService.toRule(coupon) };
  }

  // --- administration -------------------------------------------------------

  async adminList(query: AdminCouponsQueryDto): Promise<Paginated<CouponView>> {
    const where: Prisma.CouponWhereInput = {};
    if (query.search)
      where.OR = [
        { code: { contains: CouponsService.normalizeCode(query.search) } },
        { description: { contains: query.search } },
      ];
    if (query.isActive !== undefined) where.isActive = query.isActive;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.coupon.count({ where }),
      this.prisma.coupon.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
    ]);
    return {
      items: rows.map((c) => CouponsService.toView(c)),
      pagination: buildPagination(query.page, query.limit, total),
    };
  }

  async adminGet(id: string): Promise<CouponView> {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon)
      throw new NotFoundAppException('COUPON_NOT_FOUND', COUPON_MESSAGES.COUPON_NOT_FOUND);
    return CouponsService.toView(coupon);
  }

  async create(dto: CreateCouponDto): Promise<CouponView> {
    const code = CouponsService.normalizeCode(dto.code);
    const clash = await this.prisma.coupon.findUnique({ where: { code }, select: { id: true } });
    if (clash)
      throw new ConflictAppException('COUPON_CODE_TAKEN', 'این کد تخفیف قبلاً ثبت شده است');
    const coupon = await this.prisma.coupon.create({
      data: {
        code,
        description: dto.description,
        type: dto.type,
        value: dto.value,
        maxDiscountAmount:
          dto.maxDiscountAmount === undefined || dto.maxDiscountAmount === null
            ? null
            : BigInt(dto.maxDiscountAmount),
        minCartAmount:
          dto.minCartAmount === undefined || dto.minCartAmount === null
            ? null
            : BigInt(dto.minCartAmount),
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        usageLimit: dto.usageLimit ?? null,
        usageLimitPerUser: dto.usageLimitPerUser ?? null,
        isActive: dto.isActive ?? true,
      },
    });
    return CouponsService.toView(coupon);
  }

  async update(id: string, dto: UpdateCouponDto): Promise<CouponView> {
    const current = await this.prisma.coupon.findUnique({ where: { id } });
    if (!current)
      throw new NotFoundAppException('COUPON_NOT_FOUND', COUPON_MESSAGES.COUPON_NOT_FOUND);
    const code = dto.code ? CouponsService.normalizeCode(dto.code) : undefined;
    if (code && code !== current.code) {
      const clash = await this.prisma.coupon.findUnique({ where: { code }, select: { id: true } });
      if (clash)
        throw new ConflictAppException('COUPON_CODE_TAKEN', 'این کد تخفیف قبلاً ثبت شده است');
    }
    const coupon = await this.prisma.coupon.update({ where: { id }, data: this.toData(dto, code) });
    return CouponsService.toView(coupon);
  }

  async remove(id: string): Promise<void> {
    const current = await this.prisma.coupon.findUnique({ where: { id }, select: { id: true } });
    if (!current)
      throw new NotFoundAppException('COUPON_NOT_FOUND', COUPON_MESSAGES.COUPON_NOT_FOUND);
    await this.prisma.coupon.delete({ where: { id } });
  }

  private toData(dto: Partial<CreateCouponDto>, code?: string): Prisma.CouponUncheckedUpdateInput {
    return {
      ...(code ? { code } : {}),
      description: dto.description,
      type: dto.type,
      value: dto.value,
      maxDiscountAmount:
        dto.maxDiscountAmount === undefined
          ? undefined
          : dto.maxDiscountAmount === null
            ? null
            : BigInt(dto.maxDiscountAmount),
      minCartAmount:
        dto.minCartAmount === undefined
          ? undefined
          : dto.minCartAmount === null
            ? null
            : BigInt(dto.minCartAmount),
      startsAt:
        dto.startsAt === undefined
          ? undefined
          : dto.startsAt === null
            ? null
            : new Date(dto.startsAt),
      endsAt:
        dto.endsAt === undefined ? undefined : dto.endsAt === null ? null : new Date(dto.endsAt),
      usageLimit: dto.usageLimit,
      usageLimitPerUser: dto.usageLimitPerUser,
      isActive: dto.isActive,
    };
  }
}
