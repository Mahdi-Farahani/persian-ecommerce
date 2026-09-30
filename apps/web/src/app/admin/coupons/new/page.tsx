import { hasPermission } from '@pe/shared';
import Link from 'next/link';
import { CouponForm } from '@/components/admin/coupons/coupon-form';
import { Forbidden } from '@/components/admin/forbidden';
import { PageHeader } from '@/components/admin/page-header';
import { Card } from '@/components/ui/card';
import { adminFa } from '@/i18n/admin-fa';
import { AdminPermissions } from '@/lib/admin/navigation';
import { requireUser } from '@/lib/auth/server';

export const metadata = { title: adminFa.coupons.newTitle };

export default async function AdminNewCouponPage() {
  const user = await requireUser('/admin/coupons/new');
  if (!hasPermission(user, AdminPermissions.discountsManage)) return <Forbidden />;

  return (
    <div>
      <PageHeader
        title={adminFa.coupons.newTitle}
        actions={
          <Link href="/admin/coupons" className="text-sm text-ink-muted hover:text-brand-700">
            {adminFa.coupons.backToList}
          </Link>
        }
      />
      <Card>
        <CouponForm />
      </Card>
    </div>
  );
}
