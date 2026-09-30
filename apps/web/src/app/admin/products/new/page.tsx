import { hasPermission } from '@pe/shared';
import { Forbidden } from '@/components/admin/forbidden';
import { PageHeader } from '@/components/admin/page-header';
import { ProductForm } from '@/components/admin/products/product-form';
import { adminFa } from '@/i18n/admin-fa';
import { flattenCategoryTree } from '@/lib/admin/categories';
import { AdminPermissions } from '@/lib/admin/navigation';
import { adminCategoryTree, adminListAttributes, adminListBrands } from '@/lib/admin/server';
import { requireUser } from '@/lib/auth/server';

export const metadata = { title: adminFa.products.newTitle };

export default async function AdminNewProductPage() {
  const user = await requireUser('/admin/products/new');
  if (!hasPermission(user, AdminPermissions.catalogManage)) return <Forbidden />;

  const [tree, brands, attributes] = await Promise.all([
    adminCategoryTree(),
    adminListBrands({ limit: 100, includeInactive: 'true' }),
    adminListAttributes(),
  ]);

  return (
    <div>
      <PageHeader title={adminFa.products.newTitle} />
      <ProductForm
        categories={flattenCategoryTree(tree)}
        brands={brands.items}
        attributes={attributes}
        permissions={{
          manageCatalog: true,
          viewInventory: hasPermission(user, AdminPermissions.inventoryView),
          manageInventory: hasPermission(user, AdminPermissions.inventoryManage),
        }}
      />
    </div>
  );
}
