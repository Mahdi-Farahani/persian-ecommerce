import type { InventorySummary } from './inventory.js';
import type { AdminOrderSummary } from './orders.js';

/** Admin dashboard and audit contracts. Money is integer IRR. */

export interface SalesWindow {
  /** Orders paid in the window. */
  orders: number;
  /** Sum of paid order totals (IRR). */
  revenue: number;
  /** Average paid order value (IRR), 0 when no orders. */
  averageOrderValue: number;
}

export interface DailySalesPoint {
  /** ISO calendar day (UTC), e.g. 2026-09-30. */
  date: string;
  orders: number;
  revenue: number;
}

export interface AuditLogView {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: { id: string; name: string; email: string | null } | null;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export interface DashboardMetrics {
  generatedAt: string;
  sales: {
    today: SalesWindow;
    last7Days: SalesWindow;
    last30Days: SalesWindow;
    allTime: SalesWindow;
  };
  dailySales: DailySalesPoint[];
  orders: {
    pendingPayment: number;
    paid: number;
    processing: number;
    packed: number;
    shipped: number;
    deliveredLast30Days: number;
    cancelledLast30Days: number;
    returnRequested: number;
  };
  payments: { paidLast7Days: number; failedLast7Days: number; refundedLast30Days: number };
  customers: { total: number; newLast7Days: number; newLast30Days: number };
  catalog: { activeProducts: number; draftProducts: number; brands: number; categories: number };
  inventory: InventorySummary;
  reviews: { pending: number; approvedLast30Days: number };
  recentOrders: AdminOrderSummary[];
  recentActivity: AuditLogView[];
}
