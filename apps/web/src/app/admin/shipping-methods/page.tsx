import { hasPermission } from '@pe/shared';
import { Forbidden } from '@/components/admin/forbidden';
import { PageHeader } from '@/components/admin/page-header';
import { ShippingMethodManager } from '@/components/admin/shipping-methods/shipping-method-manager';
import { adminFa } from '@/i18n/admin-fa';
import { AdminPermissions } from '@/lib/admin/navigation';
import { adminListShippingMethods } from '@/lib/admin/server';
import { requireUser } from '@/lib/auth/server';

export const metadata = { title: adminFa.shippingMethods.title };

export default async function AdminShippingMethodsPage() {
  const user = await requireUser('/admin/shipping-methods');
  const canManage = hasPermission(user, AdminPermissions.settingsManage);
  if (!canManage && !hasPermission(user, AdminPermissions.ordersView)) return <Forbidden />;

  const methods = await adminListShippingMethods();

  return (
    <div>
      <PageHeader
        title={adminFa.shippingMethods.title}
        description={adminFa.shippingMethods.description}
      />
      <ShippingMethodManager methods={methods} canManage={canManage} />
    </div>
  );
}
