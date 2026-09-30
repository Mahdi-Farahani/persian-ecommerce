import { ChangePasswordForm } from '@/components/account/change-password-form';
import { LogoutAllButton } from '@/components/account/logout-all-button';
import { Card, CardTitle } from '@/components/ui/card';
import { t } from '@/i18n';
import { requireUser } from '@/lib/auth/server';

export default async function AccountSecurityPage() {
  await requireUser('/account/security');
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardTitle>{t.account.changePassword}</CardTitle>
        <ChangePasswordForm />
      </Card>
      <Card>
        <CardTitle>{t.account.sessions}</CardTitle>
        <p className="mb-4 text-sm text-ink-muted">{t.account.logoutAllHint}</p>
        <LogoutAllButton />
      </Card>
    </div>
  );
}
