import { Injectable, Logger } from '@nestjs/common';
import {
  buildPagination,
  type AdminSellerView,
  type Paginated,
  type SellerProfileView,
} from '@pe/shared';
import {
  ConflictAppException,
  ForbiddenAppException,
  NotFoundAppException,
  UnprocessableAppException,
} from '../common/errors/app.exception.js';
import { resolveUniqueSlug } from '../common/utils/slug.util.js';
import { money } from '../common/utils/money.util.js';
import { AppConfigService } from '../config/app-config.service.js';
import type { Prisma, Seller } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RoleName } from '../rbac/permissions.js';
import { UsersService } from '../users/users.service.js';
import type {
  AdminSellersQueryDto,
  ApplySellerDto,
  UpdateSellerCommissionDto,
  UpdateSellerProfileDto,
  UpdateSellerStatusDto,
} from './dto/seller.dto.js';
import { adminSellerInclude, toAdminSeller, toSellerProfile } from './sellers.mapper.js';

/**
 * Seller onboarding and administration. The SELLER role (and with it the
 * `seller.portal` permission) is granted on approval and revoked on
 * suspension/rejection, so portal access always reflects the seller status.
 */
@Injectable()
export class SellersService {
  private readonly logger = new Logger(SellersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly config: AppConfigService,
  ) {}

  async apply(userId: string, dto: ApplySellerDto): Promise<SellerProfileView> {
    const existing = await this.prisma.seller.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictAppException('SELLER_EXISTS', 'شما قبلاً درخواست فروشندگی ثبت کرده‌اید', {
        status: existing.status,
      });
    }
    const nameTaken = await this.prisma.seller.findUnique({ where: { storeName: dto.storeName } });
    if (nameTaken)
      throw new ConflictAppException('STORE_NAME_TAKEN', 'این نام فروشگاه قبلاً ثبت شده است');
    const slug = await resolveUniqueSlug(undefined, dto.storeName, async (s) =>
      Boolean(await this.prisma.seller.findUnique({ where: { slug: s }, select: { id: true } })),
    );
    const seller = await this.prisma.seller.create({
      data: {
        userId,
        slug,
        commissionBps: this.config.marketplace.defaultCommissionBps,
        storeName: dto.storeName,
        contactPhone: dto.contactPhone,
        description: dto.description || null,
        contactEmail: dto.contactEmail || null,
        legalName: dto.legalName || null,
        nationalId: dto.nationalId || null,
        iban: dto.iban || null,
        province: dto.province || null,
        city: dto.city || null,
        addressLine: dto.addressLine || null,
      },
    });
    this.logger.log({ message: 'seller applied', sellerId: seller.id, userId });
    return toSellerProfile(seller);
  }

  async profileOf(userId: string): Promise<SellerProfileView | null> {
    const seller = await this.prisma.seller.findUnique({ where: { userId } });
    return seller ? toSellerProfile(seller) : null;
  }

  async updateProfile(userId: string, dto: UpdateSellerProfileDto): Promise<SellerProfileView> {
    const seller = await this.requireByUser(userId);
    if (dto.storeName && dto.storeName !== seller.storeName) {
      const taken = await this.prisma.seller.findUnique({ where: { storeName: dto.storeName } });
      if (taken)
        throw new ConflictAppException('STORE_NAME_TAKEN', 'این نام فروشگاه قبلاً ثبت شده است');
    }
    const updated = await this.prisma.seller.update({
      where: { id: seller.id },
      data: {
        ...this.profileData(dto),
        ...(dto.storeName ? { storeName: dto.storeName } : {}),
        ...(dto.contactPhone ? { contactPhone: dto.contactPhone } : {}),
        // A rejected applicant who edits their file re-enters the queue.
        ...(seller.status === 'REJECTED' ? { status: 'PENDING', rejectionReason: null } : {}),
      },
    });
    return toSellerProfile(updated);
  }

  /** Approved seller of the given user; anything else is refused. */
  async requireApproved(userId: string): Promise<Seller> {
    const seller = await this.prisma.seller.findUnique({ where: { userId } });
    if (!seller) throw new ForbiddenAppException('SELLER_REQUIRED', 'حساب فروشندگی ندارید');
    if (seller.status !== 'APPROVED') {
      throw new ForbiddenAppException(
        'SELLER_NOT_APPROVED',
        seller.status === 'PENDING'
          ? 'درخواست فروشندگی شما هنوز تأیید نشده است'
          : 'حساب فروشندگی شما فعال نیست',
        { status: seller.status },
      );
    }
    return seller;
  }

  async requireByUser(userId: string): Promise<Seller> {
    const seller = await this.prisma.seller.findUnique({ where: { userId } });
    if (!seller) throw new NotFoundAppException('SELLER_NOT_FOUND', 'حساب فروشندگی پیدا نشد');
    return seller;
  }

  async findPublicBySlug(slug: string): Promise<Seller | null> {
    return this.prisma.seller.findFirst({ where: { slug, status: 'APPROVED' } });
  }

  // --- administration -------------------------------------------------------------

  async adminList(query: AdminSellersQueryDto): Promise<Paginated<AdminSellerView>> {
    const where: Prisma.SellerWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { storeName: { contains: query.search } },
        { user: { email: { contains: query.search } } },
        { user: { phone: { contains: query.search } } },
        { contactPhone: { contains: query.search } },
      ];
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.seller.count({ where }),
      this.prisma.seller.findMany({
        where,
        include: adminSellerInclude,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: query.skip,
        take: query.limit,
      }),
    ]);
    const pending = await this.pendingAmounts(rows.map((r) => r.id));
    return {
      items: rows.map((r) => toAdminSeller(r, pending.get(r.id) ?? 0)),
      pagination: buildPagination(query.page, query.limit, total),
    };
  }

  async adminGet(sellerId: string): Promise<AdminSellerView> {
    const row = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      include: adminSellerInclude,
    });
    if (!row) throw new NotFoundAppException('SELLER_NOT_FOUND', 'فروشنده پیدا نشد');
    const pending = await this.pendingAmounts([sellerId]);
    return toAdminSeller(row, pending.get(sellerId) ?? 0);
  }

  async adminSetStatus(sellerId: string, dto: UpdateSellerStatusDto): Promise<AdminSellerView> {
    const seller = await this.prisma.seller.findUnique({ where: { id: sellerId } });
    if (!seller) throw new NotFoundAppException('SELLER_NOT_FOUND', 'فروشنده پیدا نشد');
    if (seller.status === dto.status) {
      throw new UnprocessableAppException(
        'SELLER_STATUS_UNCHANGED',
        'فروشنده از قبل در این وضعیت است',
      );
    }
    if (dto.status === 'REJECTED' && seller.status !== 'PENDING') {
      throw new UnprocessableAppException(
        'SELLER_STATUS_INVALID',
        'فقط درخواست‌های در انتظار قابل رد شدن هستند',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.seller.update({
        where: { id: sellerId },
        data: {
          status: dto.status,
          rejectionReason: dto.status === 'REJECTED' ? (dto.reason ?? null) : null,
          approvedAt: dto.status === 'APPROVED' ? new Date() : seller.approvedAt,
          suspendedAt: dto.status === 'SUSPENDED' ? new Date() : null,
        },
      });
      if (dto.status !== 'APPROVED') {
        // Offers of a suspended/rejected seller must disappear from the storefront.
        await tx.productVariant.updateMany({
          where: { sellerId, status: 'ACTIVE' },
          data: { status: 'INACTIVE' },
        });
      }
      await this.users.setRoleMembership(
        tx,
        seller.userId,
        RoleName.Seller,
        dto.status === 'APPROVED',
      );
    });
    this.logger.log({ message: 'seller status changed', sellerId, status: dto.status });
    return this.adminGet(sellerId);
  }

  async adminSetCommission(
    sellerId: string,
    dto: UpdateSellerCommissionDto,
  ): Promise<AdminSellerView> {
    await this.adminGet(sellerId);
    await this.prisma.seller.update({
      where: { id: sellerId },
      data: { commissionBps: dto.commissionBps },
    });
    return this.adminGet(sellerId);
  }

  private async pendingAmounts(sellerIds: string[]): Promise<Map<string, number>> {
    if (sellerIds.length === 0) return new Map();
    const groups = await this.prisma.orderItem.groupBy({
      by: ['sellerId'],
      where: { sellerId: { in: sellerIds }, settlementId: null, order: { status: 'DELIVERED' } },
      _sum: { sellerAmount: true },
    });
    return new Map(groups.map((g) => [g.sellerId!, money(g._sum.sellerAmount ?? 0n)]));
  }

  private profileData(dto: UpdateSellerProfileDto): Prisma.SellerUpdateInput {
    const data: Prisma.SellerUpdateInput = {};
    for (const key of [
      'description',
      'contactEmail',
      'legalName',
      'nationalId',
      'iban',
      'province',
      'city',
      'addressLine',
    ] as const) {
      if (dto[key] !== undefined) data[key] = dto[key] || null;
    }
    return data;
  }
}
