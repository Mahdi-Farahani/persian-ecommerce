import 'server-only';
import type {
  AdminOrderDetail,
  AdminOrderSummary,
  AdminPaymentDetail,
  AdminPaymentSummary,
  AdminReviewView,
  AttributeSummary,
  AuditLogView,
  BrandDetail,
  CategoryNode,
  DashboardMetrics,
  InventoryItemView,
  InventorySnapshot,
  InventorySummary,
  InventoryTransactionView,
  Paginated,
  PaymentGatewayAdminView,
  ProductCard,
  ProductDetail,
} from '@pe/shared';
import type { QueryValue } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { serverApi } from '@/lib/api/server';
import type { AdminCategory, AdminCoupon, AdminShippingMethod, AdminUser, RoleInfo } from './types';

const noStore = { cache: 'no-store' as const };

export function adminListProducts(query: Record<string, QueryValue>) {
  return serverApi<Paginated<ProductCard>>('/admin/products', { query, ...noStore });
}

export async function adminGetProduct(id: string): Promise<ProductDetail | null> {
  try {
    return await serverApi<ProductDetail>(`/admin/products/${encodeURIComponent(id)}`, noStore);
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) return null;
    throw error;
  }
}

export function adminListCategories() {
  return serverApi<AdminCategory[]>('/admin/categories', noStore);
}

export function adminCategoryTree() {
  return serverApi<CategoryNode[]>('/admin/categories/tree', noStore);
}

export function adminListBrands(query: Record<string, QueryValue>) {
  return serverApi<Paginated<BrandDetail>>('/admin/brands', { query, ...noStore });
}

export function adminListAttributes() {
  return serverApi<AttributeSummary[]>('/admin/attributes', noStore);
}

export function adminListUsers(query: Record<string, QueryValue>) {
  return serverApi<Paginated<AdminUser>>('/admin/users', { query, ...noStore });
}

export function adminListRoles() {
  return serverApi<RoleInfo[]>('/admin/roles', noStore);
}

export function adminListOrders(query: Record<string, QueryValue>) {
  return serverApi<Paginated<AdminOrderSummary>>('/admin/orders', { query, ...noStore });
}

export async function adminGetOrder(id: string): Promise<AdminOrderDetail | null> {
  try {
    return await serverApi<AdminOrderDetail>(`/admin/orders/${encodeURIComponent(id)}`, noStore);
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) return null;
    throw error;
  }
}

export function adminListPayments(query: Record<string, QueryValue>) {
  return serverApi<Paginated<AdminPaymentSummary>>('/admin/payments', { query, ...noStore });
}

export async function adminGetPayment(id: string): Promise<AdminPaymentDetail | null> {
  try {
    return await serverApi<AdminPaymentDetail>(
      `/admin/payments/${encodeURIComponent(id)}`,
      noStore,
    );
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) return null;
    throw error;
  }
}

export function adminListInventory(query: Record<string, QueryValue>) {
  return serverApi<Paginated<InventoryItemView>>('/admin/inventory', { query, ...noStore });
}

export function adminInventorySummary() {
  return serverApi<InventorySummary>('/admin/inventory/summary', noStore);
}

export async function adminGetInventory(variantId: string): Promise<InventorySnapshot | null> {
  try {
    return await serverApi<InventorySnapshot>(
      `/admin/inventory/${encodeURIComponent(variantId)}`,
      noStore,
    );
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) return null;
    throw error;
  }
}

export function adminInventoryTransactions(variantId: string) {
  return serverApi<InventoryTransactionView[]>(
    `/admin/inventory/${encodeURIComponent(variantId)}/transactions`,
    noStore,
  );
}

export function adminListReviews(query: Record<string, QueryValue>) {
  return serverApi<Paginated<AdminReviewView>>('/admin/reviews', { query, ...noStore });
}

export async function adminGetReview(id: string): Promise<AdminReviewView | null> {
  try {
    return await serverApi<AdminReviewView>(`/admin/reviews/${encodeURIComponent(id)}`, noStore);
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) return null;
    throw error;
  }
}

export function adminListPaymentGateways() {
  return serverApi<PaymentGatewayAdminView[]>('/admin/payment-gateways', noStore);
}

export function adminDashboard() {
  return serverApi<DashboardMetrics>('/admin/dashboard', noStore);
}

export function adminListAuditLogs(query: Record<string, QueryValue>) {
  return serverApi<Paginated<AuditLogView>>('/admin/audit-logs', { query, ...noStore });
}

export function adminAuditLogActions() {
  return serverApi<string[]>('/admin/audit-logs/actions', noStore);
}

export function adminListCoupons(query: Record<string, QueryValue>) {
  return serverApi<Paginated<AdminCoupon>>('/admin/coupons', { query, ...noStore });
}

export async function adminGetCoupon(id: string): Promise<AdminCoupon | null> {
  try {
    return await serverApi<AdminCoupon>(`/admin/coupons/${encodeURIComponent(id)}`, noStore);
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) return null;
    throw error;
  }
}

export function adminListShippingMethods() {
  return serverApi<AdminShippingMethod[]>('/admin/shipping-methods', noStore);
}

/** Resolves to null instead of throwing when the caller lacks permission. */
export async function optional<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 0)) return null;
    throw error;
  }
}

/** Parses a positive integer page number from a search param. */
export function parsePage(value: string | undefined): number {
  const page = Number.parseInt(value ?? '', 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

/** Builds a query string preserving the current filters with a new page. */
export function pageHref(
  basePath: string,
  params: Record<string, string | undefined>,
): (page: number) => string {
  return (page) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
    if (page > 1) search.set('page', String(page));
    else search.delete('page');
    const qs = search.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
}
