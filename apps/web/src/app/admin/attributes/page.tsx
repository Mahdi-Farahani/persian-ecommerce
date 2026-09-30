import { formatPersianNumber, hasPermission } from '@pe/shared';
import { AttributeManager } from '@/components/admin/attributes/attribute-manager';
import { PageHeader } from '@/components/admin/page-header';
import { adminFa } from '@/i18n/admin-fa';
import { AdminPermissions } from '@/lib/admin/navigation';
import { adminListAttributes } from '@/lib/admin/server';
import { requireUser } from '@/lib/auth/server';

export const metadata = { title: adminFa.attributes.title };

export default async function AdminAttributesPage() {
  const user = await requireUser('/admin/attributes');
  const attributes = await adminListAttributes();
  return (
    <div>
      <PageHeader
        title={adminFa.attributes.title}
        description={adminFa.common.total(formatPersianNumber(attributes.length))}
      />
      <AttributeManager
        attributes={attributes}
        canManage={hasPermission(user, AdminPermissions.catalogManage)}
      />
    </div>
  );
}
