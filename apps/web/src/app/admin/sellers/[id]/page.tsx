import {
  OrderStatuses,
  formatJalaliDate,
  formatJalaliDateTime,
  formatPersianNumber,
  formatToman,
  hasPermission,
  toPersianDigits,
  toToman,
  type AdminOrderSummary,
  type AdminSellerView,
  type AdminSettlementView,
  type Paginated,
  type SellerOfferView,
} from '@pe/shared';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, productStatusTone } from '@/components/admin/badge';
import { DataTable, Td } from '@/components/admin/data-table';
import { Forbidden } from '@/components/admin/forbidden';
import { StockBadge } from '@/components/admin/inventory/inventory-row';
import { PageHeader } from '@/components/admin/page-header';
import { CreateSettlementButton } from '@/components/admin/sellers/create-settlement-button';
import { SellerCommissionForm } from '@/components/admin/sellers/seller-commission-form';
import { SellerStatusActions } from '@/components/admin/sellers/seller-status-actions';
import { SellerTabs, pickSellerTab, type SellerTab } from '@/components/admin/sellers/seller-tabs';
import { SellerStatusBadge, SettlementStatusBadge } from '@/components/admin/sellers/status-badges';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { SelectField, TextField } from '@/components/ui/form-field';
import { Pagination } from '@/components/ui/pagination';
import { t } from '@/i18n';
import { adminFa } from '@/i18n/admin-fa';
import { AdminPermissions } from '@/lib/admin/navigation';
import { formatCommissionPercent } from '@/lib/admin/sellers';
import {
  adminGetSeller,
  adminListSellerOffers,
  adminListSellerOrders,
  adminListSettlements,
  pageHref,
  parsePage,
} from '@/lib/admin/server';
import { assetUrl } from '@/lib/assets';
import { requireUser } from '@/lib/auth/server';
import { orderStatusLabel } from '@/lib/orders/status';

export const metadata = { title: adminFa.sellers.detailTitle };

const copy = adminFa.sellers;
const PAGE_SIZE = 20;

const offerColumns = [
  { key: 'image', label: copy.offers.table.image, srOnly: true },
  { key: 'product', label: copy.offers.table.product },
  { key: 'sku', label: copy.offers.table.sku },
  { key: 'price', label: copy.offers.table.price },
  { key: 'stock', label: copy.offers.table.stock },
  { key: 'reserved', label: copy.offers.table.reserved },
  { key: 'available', label: copy.offers.table.available },
  { key: 'status', label: copy.offers.table.status },
] as const;

const orderColumns = [
  { key: 'number', label: adminFa.orders.table.number },
  { key: 'customer', label: adminFa.orders.table.customer },
  { key: 'date', label: adminFa.orders.table.date },
  { key: 'items', label: adminFa.orders.table.items },
  { key: 'total', label: adminFa.orders.table.total },
  { key: 'status', label: adminFa.orders.table.status },
] as const;

const settlementColumns = [
  { key: 'createdAt', label: adminFa.settlements.table.createdAt },
  { key: 'gross', label: adminFa.settlements.table.gross },
  { key: 'commission', label: adminFa.settlements.table.commission },
  { key: 'net', label: adminFa.settlements.table.net },
  { key: 'items', label: adminFa.settlements.table.items },
  { key: 'status', label: adminFa.settlements.table.status },
] as const;

const orderStatusOptions = OrderStatuses.map((status) => ({
  value: status,
  label: orderStatusLabel(status),
}));

interface SearchParams {
  tab?: string;
  page?: string;
  status?: string;
  search?: string;
}

function OffersTab({
  result,
  hrefFor,
}: {
  result: Paginated<SellerOfferView>;
  hrefFor: (page: number) => string;
}) {
  return (
    <>
      <DataTable
        columns={offerColumns}
        empty={result.items.length === 0}
        emptyMessage={copy.offers.empty}
        caption={copy.tabs.offers}
      >
        {result.items.map((offer) => {
          const image = assetUrl(offer.imageUrl);
          const title = offer.attributes.map((attribute) => attribute.value).join(' / ');
          return (
            <tr key={offer.variantId} className="hover:bg-surface-muted/60">
              <Td>
                <div className="relative size-12 overflow-hidden rounded-lg border border-border bg-surface-muted">
                  {image ? (
                    <Image
                      src={image}
                      alt=""
                      fill
                      sizes="48px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="grid h-full place-items-center text-[10px] text-ink-muted">
                      {t.catalog.noImage}
                    </span>
                  )}
                </div>
              </Td>
              <Td>
                <Link
                  href={`/admin/products/${offer.productId}`}
                  className="font-medium hover:text-brand-700"
                >
                  {offer.productTitle}
                </Link>
                <span className="block text-xs text-ink-muted">
                  {offer.title || title || adminFa.common.none}
                </span>
              </Td>
              <Td>
                <span dir="ltr" className="inline-block font-mono text-xs">
                  {offer.sku}
                </span>
              </Td>
              <Td className="tabular-nums">
                {formatPersianNumber(toToman(offer.price))}
                {offer.compareAtPrice ? (
                  <span className="ms-1 text-xs text-ink-muted line-through">
                    {formatPersianNumber(toToman(offer.compareAtPrice))}
                  </span>
                ) : null}
              </Td>
              <Td className="tabular-nums">{formatPersianNumber(offer.stockQuantity)}</Td>
              <Td className="tabular-nums">{formatPersianNumber(offer.reservedQuantity)}</Td>
              <Td className="font-bold tabular-nums">
                {formatPersianNumber(offer.availableQuantity)}
              </Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  <Badge tone={offer.status === 'ACTIVE' ? 'success' : 'neutral'}>
                    {adminFa.products.variants.statusLabels[offer.status] ?? offer.status}
                  </Badge>
                  <Badge tone={productStatusTone(offer.productStatus)}>
                    {adminFa.products.status[offer.productStatus] ?? offer.productStatus}
                  </Badge>
                  <StockBadge item={offer} />
                </div>
              </Td>
            </tr>
          );
        })}
      </DataTable>
      <div className="mt-4">
        <Pagination pagination={result.pagination} hrefFor={hrefFor} />
      </div>
    </>
  );
}

function OrdersTab({
  sellerId,
  result,
  status,
  search,
  hrefFor,
}: {
  sellerId: string;
  result: Paginated<AdminOrderSummary>;
  status: string;
  search: string;
  hrefFor: (page: number) => string;
}) {
  return (
    <>
      <form
        method="get"
        action={`/admin/sellers/${sellerId}`}
        className="mb-4 flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="tab" value="orders" />
        <TextField
          label={adminFa.common.search}
          name="search"
          defaultValue={search}
          placeholder={copy.orders.searchPlaceholder}
          containerClassName="min-w-56 flex-1"
        />
        <SelectField
          label={adminFa.common.status}
          name="status"
          defaultValue={status}
          placeholder={adminFa.orders.allStatuses}
          options={orderStatusOptions}
        />
        <Button type="submit" variant="secondary">
          {adminFa.common.filter}
        </Button>
        {status || search ? (
          <Link
            href={`/admin/sellers/${sellerId}?tab=orders`}
            className="inline-flex h-11 items-center px-2 text-sm text-ink-muted hover:text-brand-700"
          >
            {adminFa.common.clearFilters}
          </Link>
        ) : null}
      </form>
      <DataTable
        columns={orderColumns}
        empty={result.items.length === 0}
        emptyMessage={copy.orders.empty}
        caption={copy.tabs.orders}
      >
        {result.items.map((order) => (
          <tr key={order.id} className="hover:bg-surface-muted/60">
            <Td>
              <Link
                href={`/admin/orders/${order.id}`}
                className="font-medium tabular-nums hover:text-brand-700"
                dir="ltr"
              >
                {toPersianDigits(order.number)}
              </Link>
            </Td>
            <Td>
              <div className="flex flex-col">
                <span>{order.customer.name || adminFa.orders.noName}</span>
                <span className="text-xs text-ink-muted" dir="ltr">
                  {order.customer.email ??
                    (order.customer.phone ? toPersianDigits(order.customer.phone) : '')}
                </span>
              </div>
            </Td>
            <Td className="text-xs text-ink-muted">{formatJalaliDateTime(order.createdAt)}</Td>
            <Td className="tabular-nums">{formatPersianNumber(order.itemCount)}</Td>
            <Td className="tabular-nums">{formatPersianNumber(toToman(order.total))}</Td>
            <Td>
              <OrderStatusBadge status={order.status} />
            </Td>
          </tr>
        ))}
      </DataTable>
      <div className="mt-4">
        <Pagination pagination={result.pagination} hrefFor={hrefFor} />
      </div>
    </>
  );
}

function SettlementsTab({
  seller,
  result,
  canManage,
  hrefFor,
}: {
  seller: AdminSellerView;
  result: Paginated<AdminSettlementView>;
  canManage: boolean;
  hrefFor: (page: number) => string;
}) {
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          <span className="text-ink-muted">{copy.pendingSettlementAmount}: </span>
          <span className="font-bold tabular-nums">
            {formatToman(seller.pendingSettlementAmount)}
          </span>
        </p>
        {canManage ? (
          <CreateSettlementButton
            sellerId={seller.id}
            pendingAmount={seller.pendingSettlementAmount}
          />
        ) : null}
      </div>
      <DataTable
        columns={settlementColumns}
        empty={result.items.length === 0}
        emptyMessage={copy.settlements.empty}
        caption={copy.tabs.settlements}
      >
        {result.items.map((settlement) => (
          <tr key={settlement.id} className="hover:bg-surface-muted/60">
            <Td>
              <Link
                href={`/admin/settlements/${settlement.id}`}
                className="text-xs font-medium whitespace-nowrap hover:text-brand-700"
              >
                {formatJalaliDateTime(settlement.createdAt)}
              </Link>
            </Td>
            <Td className="tabular-nums">{formatPersianNumber(toToman(settlement.grossAmount))}</Td>
            <Td className="tabular-nums">
              {formatPersianNumber(toToman(settlement.commissionAmount))}
            </Td>
            <Td className="font-bold tabular-nums">
              {formatPersianNumber(toToman(settlement.netAmount))}
            </Td>
            <Td className="tabular-nums">{formatPersianNumber(settlement.itemCount)}</Td>
            <Td>
              <SettlementStatusBadge status={settlement.status} />
            </Td>
          </tr>
        ))}
      </DataTable>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Pagination pagination={result.pagination} hrefFor={hrefFor} />
        <Link
          href={`/admin/settlements?sellerId=${encodeURIComponent(seller.id)}`}
          className="text-xs font-medium text-brand-700 hover:underline"
        >
          {copy.settlements.viewAll}
        </Link>
      </div>
    </>
  );
}

async function loadTab(tab: SellerTab, seller: AdminSellerView, params: SearchParams) {
  const page = parsePage(params.page);
  const base = `/admin/sellers/${seller.id}`;
  switch (tab) {
    case 'orders': {
      const status =
        params.status && (OrderStatuses as readonly string[]).includes(params.status)
          ? params.status
          : '';
      const search = params.search?.trim() ?? '';
      const result = await adminListSellerOrders(seller.id, {
        page,
        limit: PAGE_SIZE,
        status,
        search,
      });
      return { tab, result, status, search, hrefFor: pageHref(base, { tab, status, search }) };
    }
    case 'settlements': {
      const result = await adminListSettlements({ sellerId: seller.id, page, limit: PAGE_SIZE });
      return { tab, result, hrefFor: pageHref(base, { tab }) };
    }
    default: {
      const result = await adminListSellerOffers(seller.id, { page, limit: PAGE_SIZE });
      return { tab: 'offers' as const, result, hrefFor: pageHref(base, {}) };
    }
  }
}

export default async function AdminSellerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const user = await requireUser(`/admin/sellers/${id}`);
  if (!hasPermission(user, AdminPermissions.sellersView)) return <Forbidden />;
  const seller = await adminGetSeller(id);
  if (!seller) notFound();

  const query = await searchParams;
  const tab = pickSellerTab(query.tab);
  const canManage = hasPermission(user, AdminPermissions.sellersManage);
  const loaded = await loadTab(tab, seller, query);

  const facts: Array<{ label: string; value: string; ltr?: boolean }> = [
    { label: copy.owner, value: seller.user.name || adminFa.users.noName },
  ];
  if (seller.user.email)
    facts.push({ label: adminFa.orders.email, value: seller.user.email, ltr: true });
  if (seller.user.phone) {
    facts.push({
      label: adminFa.orders.phone,
      value: toPersianDigits(seller.user.phone),
      ltr: true,
    });
  }
  facts.push({ label: copy.contactPhone, value: toPersianDigits(seller.contactPhone), ltr: true });
  if (seller.contactEmail)
    facts.push({ label: copy.contactEmail, value: seller.contactEmail, ltr: true });
  if (seller.legalName) facts.push({ label: copy.legalName, value: seller.legalName });
  if (seller.nationalId) {
    facts.push({ label: copy.nationalId, value: toPersianDigits(seller.nationalId), ltr: true });
  }
  if (seller.ibanMasked) facts.push({ label: copy.iban, value: seller.ibanMasked, ltr: true });
  const address = [seller.province, seller.city, seller.addressLine].filter(Boolean).join('، ');
  if (address) facts.push({ label: copy.address, value: address });
  facts.push({ label: copy.offerCount, value: formatPersianNumber(seller.offerCount) });
  facts.push({ label: copy.appliedAt, value: formatJalaliDateTime(seller.createdAt) });
  if (seller.approvedAt)
    facts.push({ label: copy.approvedAt, value: formatJalaliDateTime(seller.approvedAt) });
  facts.push({ label: copy.updatedAt, value: formatJalaliDateTime(seller.updatedAt) });
  if (seller.rejectionReason)
    facts.push({ label: copy.rejectionReason, value: seller.rejectionReason });

  return (
    <div>
      <PageHeader
        title={seller.storeName}
        description={`${copy.detailTitle} · ${formatCommissionPercent(seller.commissionBps)} · ${formatJalaliDate(seller.createdAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SellerStatusBadge status={seller.status} />
            {seller.status === 'APPROVED' ? (
              <Link
                href={`/sellers/${seller.slug}`}
                className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-medium hover:border-brand-400 hover:text-brand-700"
              >
                {copy.viewInStore}
              </Link>
            ) : null}
            <Link
              href="/admin/sellers"
              className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-medium hover:border-brand-400 hover:text-brand-700"
            >
              {copy.backToList}
            </Link>
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          {seller.description ? (
            <Card className="text-sm">
              <CardTitle>{copy.storeDescription}</CardTitle>
              <p className="leading-8 whitespace-pre-line">{seller.description}</p>
            </Card>
          ) : null}
          <div>
            <SellerTabs sellerId={seller.id} active={tab} />
            {loaded.tab === 'offers' ? (
              <OffersTab result={loaded.result} hrefFor={loaded.hrefFor} />
            ) : loaded.tab === 'orders' ? (
              <OrdersTab
                sellerId={seller.id}
                result={loaded.result}
                status={loaded.status}
                search={loaded.search}
                hrefFor={loaded.hrefFor}
              />
            ) : (
              <SettlementsTab
                seller={seller}
                result={loaded.result}
                canManage={canManage}
                hrefFor={loaded.hrefFor}
              />
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-6">
          {canManage ? (
            <>
              <Card>
                <CardTitle>{adminFa.common.actions}</CardTitle>
                <SellerStatusActions
                  key={seller.status}
                  sellerId={seller.id}
                  status={seller.status}
                />
              </Card>
              <Card>
                <CardTitle>{copy.commission.title}</CardTitle>
                <SellerCommissionForm
                  key={seller.commissionBps}
                  sellerId={seller.id}
                  commissionBps={seller.commissionBps}
                />
              </Card>
            </>
          ) : null}
          <Card className="text-sm">
            <CardTitle>{copy.profile}</CardTitle>
            <dl className="grid gap-3">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="text-xs text-ink-muted">{fact.label}</dt>
                  <dd className="font-medium break-words" dir={fact.ltr ? 'ltr' : undefined}>
                    <span className={fact.ltr ? 'inline-block text-start' : undefined}>
                      {fact.value}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </aside>
      </div>
    </div>
  );
}
