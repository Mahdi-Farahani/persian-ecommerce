import { Injectable } from '@nestjs/common';
import type { DailySalesPoint, DashboardMetrics, SalesWindow } from '@pe/shared';
import { money } from '../common/utils/money.util.js';
import { Prisma } from '../generated/prisma/client.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { orderSummaryInclude, toAdminOrderSummary } from '../orders/orders.mapper.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditLogsService } from './audit-logs.service.js';

const DAY_MS = 86_400_000;
const DAILY_SERIES_DAYS = 14;
const RECENT_ORDERS = 5;
const RECENT_ACTIVITY = 10;

/** Orders whose payment counts as revenue (paid and not undone). */
const REVENUE_STATUSES = [
  'PAID',
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
  'RETURN_REQUESTED',
] as const;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async metrics(now = new Date()): Promise<DashboardMetrics> {
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const since7 = new Date(now.getTime() - 7 * DAY_MS);
    const since30 = new Date(now.getTime() - 30 * DAY_MS);
    const seriesStart = new Date(startOfToday.getTime() - (DAILY_SERIES_DAYS - 1) * DAY_MS);

    const [
      today,
      last7Days,
      last30Days,
      allTime,
      daily,
      orderCounts,
      deliveredLast30Days,
      cancelledLast30Days,
      paidLast7Days,
      failedLast7Days,
      refundedLast30Days,
      customersTotal,
      customersNew7,
      customersNew30,
      activeProducts,
      draftProducts,
      brands,
      categories,
      inventory,
      pendingReviews,
      approvedReviews30,
      recentOrderRows,
      recentActivity,
    ] = await Promise.all([
      this.salesWindow(startOfToday),
      this.salesWindow(since7),
      this.salesWindow(since30),
      this.salesWindow(null),
      this.dailySales(seriesStart, startOfToday),
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.order.count({ where: { status: 'DELIVERED', updatedAt: { gte: since30 } } }),
      this.prisma.order.count({ where: { status: 'CANCELLED', cancelledAt: { gte: since30 } } }),
      this.prisma.payment.count({ where: { status: 'PAID', verifiedAt: { gte: since7 } } }),
      this.prisma.payment.count({ where: { status: 'FAILED', updatedAt: { gte: since7 } } }),
      this.prisma.payment.count({ where: { status: 'REFUNDED', updatedAt: { gte: since30 } } }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: since7 } } }),
      this.prisma.user.count({ where: { createdAt: { gte: since30 } } }),
      this.prisma.product.count({ where: { status: 'ACTIVE' } }),
      this.prisma.product.count({ where: { status: 'DRAFT' } }),
      this.prisma.brand.count({ where: { isActive: true } }),
      this.prisma.category.count({ where: { isActive: true } }),
      this.inventory.summary(),
      this.prisma.review.count({ where: { status: 'PENDING' } }),
      this.prisma.review.count({ where: { status: 'APPROVED', moderatedAt: { gte: since30 } } }),
      this.prisma.order.findMany({
        include: {
          ...orderSummaryInclude,
          user: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: RECENT_ORDERS,
      }),
      this.auditLogs.recent(RECENT_ACTIVITY),
    ]);

    const countOf = (status: string): number =>
      orderCounts.find((g) => g.status === status)?._count._all ?? 0;

    return {
      generatedAt: now.toISOString(),
      sales: { today, last7Days, last30Days, allTime },
      dailySales: daily,
      orders: {
        pendingPayment: countOf('PENDING_PAYMENT'),
        paid: countOf('PAID'),
        processing: countOf('PROCESSING'),
        packed: countOf('PACKED'),
        shipped: countOf('SHIPPED'),
        deliveredLast30Days,
        cancelledLast30Days,
        returnRequested: countOf('RETURN_REQUESTED'),
      },
      payments: { paidLast7Days, failedLast7Days, refundedLast30Days },
      customers: {
        total: customersTotal,
        newLast7Days: customersNew7,
        newLast30Days: customersNew30,
      },
      catalog: { activeProducts, draftProducts, brands, categories },
      inventory,
      reviews: { pending: pendingReviews, approvedLast30Days: approvedReviews30 },
      recentOrders: recentOrderRows.map(toAdminOrderSummary),
      recentActivity,
    };
  }

  private async salesWindow(since: Date | null): Promise<SalesWindow> {
    const agg = await this.prisma.order.aggregate({
      where: {
        status: { in: [...REVENUE_STATUSES] },
        ...(since ? { paidAt: { gte: since } } : { paidAt: { not: null } }),
      },
      _count: { _all: true },
      _sum: { total: true },
    });
    const orders = agg._count._all;
    const revenue = money(agg._sum.total ?? 0n);
    return { orders, revenue, averageOrderValue: orders === 0 ? 0 : Math.round(revenue / orders) };
  }

  /** One point per UTC day over the series window, zero-filled. */
  private async dailySales(start: Date, lastDay: Date): Promise<DailySalesPoint[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ day: string; orders: bigint; revenue: bigint | null }>
    >(
      Prisma.sql`SELECT DATE_FORMAT(paidAt, '%Y-%m-%d') AS day, COUNT(*) AS orders, SUM(total) AS revenue
        FROM orders
        WHERE paidAt >= ${start} AND status IN (${Prisma.join([...REVENUE_STATUSES])})
        GROUP BY day ORDER BY day`,
    );
    const byDay = new Map(rows.map((r) => [r.day, r]));
    const points: DailySalesPoint[] = [];
    for (let t = start.getTime(); t <= lastDay.getTime(); t += DAY_MS) {
      const day = new Date(t).toISOString().slice(0, 10);
      const row = byDay.get(day);
      points.push({
        date: day,
        orders: Number(row?.orders ?? 0),
        revenue: Number(row?.revenue ?? 0),
      });
    }
    return points;
  }
}
