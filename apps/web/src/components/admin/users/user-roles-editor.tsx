'use client';

import { RoleNames, type RoleName } from '@pe/shared';
import { useState } from 'react';
import { Checkbox } from '@/components/admin/checkbox';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { adminFa } from '@/i18n/admin-fa';
import { adminErrorMessage } from '@/lib/admin/errors';
import type { AdminUser } from '@/lib/admin/types';
import { browserApi } from '@/lib/api/client';

interface UserRolesEditorProps {
  user: AdminUser;
  onSaved: (user: AdminUser) => void;
  onCancel: () => void;
}

const copy = adminFa.users;

/** Checkbox group to assign roles; errors from the API are shown inline. */
export function UserRolesEditor({ user, onSaved, onCancel }: UserRolesEditorProps) {
  const [selected, setSelected] = useState<RoleName[]>(user.roles);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (role: RoleName, checked: boolean) => {
    setSelected((current) =>
      checked ? [...current, role] : current.filter((item) => item !== role),
    );
  };

  const save = async () => {
    setError(null);
    if (selected.length === 0) {
      setError(copy.atLeastOneRole);
      return;
    }
    setBusy(true);
    try {
      const updated = await browserApi.patch<AdminUser>(`/admin/users/${user.id}/roles`, {
        roles: selected,
      });
      onSaved(updated);
    } catch (saveError) {
      setError(adminErrorMessage(saveError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-muted/50 p-3">
      <fieldset className="flex flex-wrap gap-4">
        <legend className="mb-2 text-xs font-medium text-ink-muted">{copy.editRoles}</legend>
        {RoleNames.map((role) => (
          <Checkbox
            key={role}
            label={copy.roles[role] ?? role}
            checked={selected.includes(role)}
            onChange={(event) => toggle(role, event.target.checked)}
          />
        ))}
      </fieldset>
      {error ? (
        <p role="alert" className="text-xs text-accent-600">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button size="sm" loading={busy} onClick={save}>
          {copy.saveRoles}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          {t.common.cancel}
        </Button>
      </div>
    </div>
  );
}
