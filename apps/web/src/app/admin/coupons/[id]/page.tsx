import { hasPermission } from '@pe/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CouponForm } from '@/components/admin/coupons/coupon-form';
import { Forbidden } from '@/components/admin/forbidden';
import { PageHeader } from '@/components/admin/page-header';
import { Card } from '@/components/ui/card';
import { adminFa } from '@/i18n/admin-fa';
import { AdminPermissions } from '@/lib/admin/navigation';
import { adminGetCoupon } from '@/lib/admin/server';
import { requireUser } from '@/lib/auth/server';

export const metadata = { title: adminFa.coupons.editTitle };

export default async function AdminEditCouponPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/admin/coupons/${id}`);
  if (!hasPermission(user, AdminPermissions.discountsManage)) return <Forbidden />;

  const coupon = await adminGetCoupon(id);
  if (!coupon) notFound();

  return (
    <div>
      <PageHeader
        title={adminFa.coupons.editTitle}
        description={coupon.code}
        actions={
          <Link href="/admin/coupons" className="text-sm text-ink-muted hover:text-brand-700">
            {adminFa.coupons.backToList}
          </Link>
        }
      />
      <Card>
        <CouponForm key={coupon.updatedAt} coupon={coupon} justCreated={created === '1'} />
      </Card>
    </div>
  );
}
