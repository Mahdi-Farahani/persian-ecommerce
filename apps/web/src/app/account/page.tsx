import { formatJalaliDate } from '@pe/shared';
import { ProfileForm } from '@/components/account/profile-form';
import { Card, CardTitle } from '@/components/ui/card';
import { t } from '@/i18n';
import { requireUser } from '@/lib/auth/server';

export default async function AccountProfilePage() {
  const user = await requireUser('/account');
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardTitle>{t.account.profileTitle}</CardTitle>
        <ProfileForm user={user} />
      </Card>
      <Card>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-muted">{t.auth.email}</dt>
            <dd className="font-medium" dir="ltr">
              {user.email ?? '—'} {user.email ? <Badge ok={user.emailVerified} /> : null}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">{t.auth.phone}</dt>
            <dd className="font-medium" dir="ltr">
              {user.phone ?? '—'} {user.phone ? <Badge ok={user.phoneVerified} /> : null}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">{t.account.memberSince}</dt>
            <dd className="font-medium">{formatJalaliDate(user.createdAt)}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}

function Badge({ ok }: { ok: boolean }) {
  return (
    <span
      className={
        ok
          ? 'ms-1 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700'
          : 'ms-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700'
      }
    >
      {ok ? t.account.verified : t.account.notVerified}
    </span>
  );
}
