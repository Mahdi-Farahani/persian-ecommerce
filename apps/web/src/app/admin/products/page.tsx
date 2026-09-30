import { ProductStatuses, formatPersianNumber, hasPermission, toToman } from '@pe/shared';
import Image from 'next/image';
import Link from 'next/link';
import { Badge, productStatusTone } from '@/components/admin/badge';
import { DataTable, Td } from '@/components/admin/data-table';
import { PageHeader } from '@/components/admin/page-header';
import { ProductFilters } from '@/components/admin/products/product-filters';
import { ProductRowActions } from '@/components/admin/products/product-row-actions';
import { Pagination } from '@/components/ui/pagination';
import { t } from '@/i18n';
import { adminFa } from '@/i18n/admin-fa';
import { AdminPermissions } from '@/lib/admin/navigation';
import { adminListProducts, pageHref, parsePage } from '@/lib/admin/server';
import { assetUrl } from '@/lib/assets';
import { requireUser } from '@/lib/auth/server';

export const metadata = { title: adminFa.products.title };

const PAGE_SIZE = 20;

const columns = [
  { key: 'image', label: adminFa.products.table.image, className: 'w-16' },
  { key: 'title', label: adminFa.products.table.title },
  { key: 'category', label: adminFa.products.table.category },
  { key: 'brand', label: adminFa.products.table.brand },
  { key: 'price', label: adminFa.products.table.price },
  { key: 'stock', label: adminFa.products.table.stock },
  { key: 'status', label: adminFa.products.table.status },
  { key: 'actions', label: adminFa.common.actions, srOnly: true, className: 'w-px' },
] as const;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}) {
  const user = await requireUser('/admin/products');
  const params = await searchParams;
  const page = parsePage(params.page);
  const search = params.search?.trim() ?? '';
  const status =
    params.status && (ProductStatuses as readonly string[]).includes(params.status)
      ? params.status
      : '';
  const canManage = hasPermission(user, AdminPermissions.catalogManage);

  const result = await adminListProducts({ page, limit: PAGE_SIZE, search, status });

  return (
    <div>
      <PageHeader
        title={adminFa.products.title}
        description={adminFa.common.total(formatPersianNumber(result.pagination.total))}
        actions={
          canManage ? (
            <Link
              href="/admin/products/new"
              className="inline-flex h-11 items-center rounded-lg bg-brand-600 px-5 text-sm font-bold text-white hover:bg-brand-700"
            >
              {adminFa.products.add}
            </Link>
          ) : null
        }
      />
      <ProductFilters search={search} status={status} />
      <DataTable
        columns={columns}
        empty={result.items.length === 0}
        caption={adminFa.products.title}
      >
        {result.items.map((product) => {
          const image = assetUrl(product.image?.url);
          return (
            <tr key={product.id} className="hover:bg-surface-muted/60">
              <Td>
                <div className="relative size-12 overflow-hidden rounded-lg border border-border bg-surface-muted">
                  {image ? (
                    <Image
                      src={image}
                      alt={product.image?.alt ?? ''}
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
                  href={`/admin/products/${product.id}`}
                  className="font-medium hover:text-brand-700"
                >
                  {product.title}
                </Link>
              </Td>
              <Td className="text-ink-muted">{product.category.name}</Td>
              <Td className="text-ink-muted">{product.brand?.name ?? adminFa.common.none}</Td>
              <Td className="tabular-nums">
                {product.price === null ? (
                  <span className="text-ink-muted">{adminFa.products.noPrice}</span>
                ) : (
                  formatPersianNumber(toToman(product.price))
                )}
              </Td>
              <Td>
                <Badge tone={product.inStock ? 'success' : 'danger'}>
                  {product.inStock ? adminFa.products.inStock : adminFa.products.outOfStock}
                </Badge>
              </Td>
              <Td>
                <Badge tone={productStatusTone(product.status)}>
                  {adminFa.products.status[product.status] ?? product.status}
                </Badge>
              </Td>
              <Td>
                <ProductRowActions
                  productId={product.id}
                  status={product.status}
                  canManage={canManage}
                />
              </Td>
            </tr>
          );
        })}
      </DataTable>
      <div className="mt-4">
        <Pagination
          pagination={result.pagination}
          hrefFor={pageHref('/admin/products', { search, status })}
        />
      </div>
    </div>
  );
}
