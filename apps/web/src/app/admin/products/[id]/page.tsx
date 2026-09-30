import { hasPermission } from '@pe/shared';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/admin/page-header';
import { ProductForm } from '@/components/admin/products/product-form';
import { adminFa } from '@/i18n/admin-fa';
import { flattenCategoryTree } from '@/lib/admin/categories';
import { AdminPermissions } from '@/lib/admin/navigation';
import {
  adminCategoryTree,
  adminGetProduct,
  adminListAttributes,
  adminListBrands,
} from '@/lib/admin/server';
import { requireUser } from '@/lib/auth/server';

export const metadata = { title: adminFa.products.editTitle };

export default async function AdminEditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/admin/products/${id}`);

  const [product, tree, brands, attributes] = await Promise.all([
    adminGetProduct(id),
    adminCategoryTree(),
    adminListBrands({ limit: 100, includeInactive: 'true' }),
    adminListAttributes(),
  ]);
  if (!product) notFound();

  return (
    <div>
      <PageHeader title={adminFa.products.editTitle} description={product.title} />
      <ProductForm
        key={product.id}
        product={product}
        categories={flattenCategoryTree(tree)}
        brands={brands.items}
        attributes={attributes}
        justCreated={created === '1'}
        permissions={{
          manageCatalog: hasPermission(user, AdminPermissions.catalogManage),
          viewInventory: hasPermission(user, AdminPermissions.inventoryView),
          manageInventory: hasPermission(user, AdminPermissions.inventoryManage),
        }}
      />
    </div>
  );
}
