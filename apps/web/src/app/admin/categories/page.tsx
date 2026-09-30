import { formatPersianNumber, hasPermission } from '@pe/shared';
import { CategoryManager } from '@/components/admin/categories/category-manager';
import { PageHeader } from '@/components/admin/page-header';
import { adminFa } from '@/i18n/admin-fa';
import { AdminPermissions } from '@/lib/admin/navigation';
import { adminListAttributes, adminListCategories } from '@/lib/admin/server';
import { requireUser } from '@/lib/auth/server';

export const metadata = { title: adminFa.categories.title };

export default async function AdminCategoriesPage() {
  const user = await requireUser('/admin/categories');
  const [categories, attributes] = await Promise.all([
    adminListCategories(),
    adminListAttributes(),
  ]);
  return (
    <div>
      <PageHeader
        title={adminFa.categories.title}
        description={adminFa.common.total(formatPersianNumber(categories.length))}
      />
      <CategoryManager
        categories={categories}
        attributes={attributes}
        canManage={hasPermission(user, AdminPermissions.catalogManage)}
      />
    </div>
  );
}
