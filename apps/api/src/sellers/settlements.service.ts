import { Injectable, Logger } from '@nestjs/common';
import {
  buildPagination,
  type AdminSettlementView,
  type Paginated,
  type SettlementView,
} from '@pe/shared';
import { NotFoundAppException, UnprocessableAppException } from '../common/errors/app.exception.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateSettlementDto,
  SettlementsQueryDto,
  UpdateSettlementDto,
} from './dto/seller.dto.js';
import { sellerPublicSelect, toAdminSettlement, toSettlement } from './sellers.mapper.js';

/**
 * Settlement batches: delivered, unsettled order items of a seller are
 * grouped into a batch (gross, commission, net). Paying out happens outside
 * the platform; the admin records the reference. Cancelling a batch releases
 * its items for a later batch.
 */
@Injectable()
export class SettlementsService {
  private readonly logger = new Logger(SettlementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listForSeller(
    sellerId: string,
    page: number,
    limit: number,
  ): Promise<Paginated<SettlementView>> {
    const where: Prisma.SettlementWhereInput = { sellerId };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.settlement.count({ where }),
      this.prisma.settlement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { items: rows.map(toSettlement), pagination: buildPagination(page, limit, total) };
  }

  async adminList(query: SettlementsQueryDto): Promise<Paginated<AdminSettlementView>> {
    const where: Prisma.SettlementWhereInput = {};
    if (query.sellerId) where.sellerId = query.sellerId;
    if (query.status) where.status = query.status;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.settlement.count({ where }),
      this.prisma.settlement.findMany({
        where,
        include: { seller: { select: sellerPublicSelect } },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
    ]);
    return {
      items: rows.map(toAdminSettlement),
      pagination: buildPagination(query.page, query.limit, total),
    };
  }

  async adminGet(settlementId: string): Promise<AdminSettlementView> {
    const row = await this.prisma.settlement.findUnique({
      where: { id: settlementId },
      include: { seller: { select: sellerPublicSelect } },
    });
    if (!row) throw new NotFoundAppException('SETTLEMENT_NOT_FOUND', 'تسویه پیدا نشد');
    return toAdminSettlement(row);
  }

  /** Creates a PENDING batch from every delivered, unsettled item of the seller. */
  async create(
    sellerId: string,
    dto: CreateSettlementDto,
    actorId: string,
  ): Promise<AdminSettlementView> {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      select: { id: true },
    });
    if (!seller) throw new NotFoundAppException('SELLER_NOT_FOUND', 'فروشنده پیدا نشد');
    const id = await this.prisma.$transaction(async (tx) => {
      const items = await tx.orderItem.findMany({
        where: { sellerId, settlementId: null, order: { status: 'DELIVERED' } },
        select: {
          id: true,
          lineTotal: true,
          commissionAmount: true,
          sellerAmount: true,
          order: { select: { paidAt: true } },
        },
      });
      if (items.length === 0) {
        throw new UnprocessableAppException(
          'SETTLEMENT_EMPTY',
          'اقلام تحویل‌شدهٔ تسویه‌نشده‌ای برای این فروشنده وجود ندارد',
        );
      }
      const paidDates = items.map((i) => i.order.paidAt?.getTime() ?? 0).filter((t) => t > 0);
      const settlement = await tx.settlement.create({
        data: {
          sellerId,
          grossAmount: items.reduce((s, i) => s + i.lineTotal, 0n),
          commissionAmount: items.reduce((s, i) => s + i.commissionAmount, 0n),
          netAmount: items.reduce((s, i) => s + i.sellerAmount, 0n),
          itemCount: items.length,
          periodStart: paidDates.length ? new Date(Math.min(...paidDates)) : null,
          periodEnd: paidDates.length ? new Date(Math.max(...paidDates)) : null,
          note: dto.note ?? null,
          createdById: actorId,
        },
      });
      await tx.orderItem.updateMany({
        where: { id: { in: items.map((i) => i.id) } },
        data: { settlementId: settlement.id },
      });
      return settlement.id;
    });
    this.logger.log({ message: 'settlement created', settlementId: id, sellerId });
    return this.adminGet(id);
  }

  async update(settlementId: string, dto: UpdateSettlementDto): Promise<AdminSettlementView> {
    const row = await this.prisma.settlement.findUnique({ where: { id: settlementId } });
    if (!row) throw new NotFoundAppException('SETTLEMENT_NOT_FOUND', 'تسویه پیدا نشد');
    if (row.status !== 'PENDING') {
      throw new UnprocessableAppException(
        'SETTLEMENT_NOT_PENDING',
        'فقط تسویه‌های در انتظار قابل تغییر هستند',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.settlement.update({
        where: { id: settlementId },
        data: {
          status: dto.status,
          paymentReference: dto.status === 'PAID' ? (dto.paymentReference ?? null) : null,
          paidAt: dto.status === 'PAID' ? new Date() : null,
          note: dto.note ?? row.note,
        },
      });
      if (dto.status === 'CANCELLED') {
        await tx.orderItem.updateMany({ where: { settlementId }, data: { settlementId: null } });
      }
    });
    return this.adminGet(settlementId);
  }
}
