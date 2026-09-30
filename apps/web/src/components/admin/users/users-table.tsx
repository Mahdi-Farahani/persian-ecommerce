'use client';

import { UserStatuses, displayName, formatJalaliDateTime, toPersianDigits } from '@pe/shared';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { Badge, userStatusTone } from '@/components/admin/badge';
import { DataTable, Td } from '@/components/admin/data-table';
import { Button } from '@/components/ui/button';
import { adminFa } from '@/i18n/admin-fa';
import { adminErrorMessage } from '@/lib/admin/errors';
import type { AdminUser } from '@/lib/admin/types';
import { browserApi } from '@/lib/api/client';
import { UserRolesEditor } from './user-roles-editor';

interface UsersTableProps {
  users: AdminUser[];
  canManage: boolean;
}

const copy = adminFa.users;

const columns = [
  { key: 'user', label: copy.table.user },
  { key: 'contact', label: copy.table.contact },
  { key: 'roles', label: copy.table.roles },
  { key: 'status', label: copy.table.status },
  { key: 'dates', label: copy.table.createdAt },
  { key: 'actions', label: adminFa.common.actions, srOnly: true, className: 'w-px' },
] as const;

export function UsersTable({ users, canManage }: UsersTableProps) {
  return (
    <DataTable
      columns={columns}
      empty={users.length === 0}
      emptyMessage={copy.empty}
      caption={copy.title}
    >
      {users.map((user) => (
        <UserRow key={user.id} initial={user} canManage={canManage} />
      ))}
    </DataTable>
  );
}

function UserRow({ initial, canManage }: { initial: AdminUser; canManage: boolean }) {
  const router = useRouter();
  const selectId = useId();
  const [user, setUser] = useState(initial);
  const [editingRoles, setEditingRoles] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const name = displayName(user) || copy.noName;

  const changeStatus = async (status: string) => {
    if (status === user.status) return;
    setBusy(true);
    setMessage(null);
    try {
      const updated = await browserApi.patch<AdminUser>(`/admin/users/${user.id}/status`, {
        status,
      });
      setUser(updated);
      setMessage({ tone: 'success', text: copy.statusChanged });
      router.refresh();
    } catch (error) {
      setMessage({ tone: 'error', text: adminErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <tr className="hover:bg-surface-muted/60">
        <Td>
          <span className="font-medium">{name}</span>
        </Td>
        <Td>
          <div className="flex flex-col text-xs text-ink-muted" dir="ltr">
            <span className="text-start">{user.email ?? adminFa.common.none}</span>
            <span className="text-start">
              {user.phone ? toPersianDigits(user.phone) : adminFa.common.none}
            </span>
          </div>
        </Td>
        <Td>
          <div className="flex flex-wrap gap-1">
            {user.roles.map((role) => (
              <Badge key={role} tone={role === 'CUSTOMER' ? 'neutral' : 'info'}>
                {copy.roles[role] ?? role}
              </Badge>
            ))}
          </div>
        </Td>
        <Td>
          {canManage ? (
            <>
              <label htmlFor={selectId} className="sr-only">
                {copy.changeStatus}
              </label>
              <select
                id={selectId}
                value={user.status}
                disabled={busy}
                onChange={(event) => void changeStatus(event.target.value)}
                className="h-9 rounded-lg border border-border bg-surface px-2 text-xs"
              >
                {UserStatuses.map((status) => (
                  <option key={status} value={status}>
                    {copy.status[status] ?? status}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <Badge tone={userStatusTone(user.status)}>
              {copy.status[user.status] ?? user.status}
            </Badge>
          )}
        </Td>
        <Td>
          <div className="flex flex-col text-xs text-ink-muted">
            <span>{formatJalaliDateTime(user.createdAt)}</span>
            <span>
              {copy.table.lastLogin}:{' '}
              {user.lastLoginAt ? formatJalaliDateTime(user.lastLoginAt) : copy.never}
            </span>
          </div>
        </Td>
        <Td>
          {canManage ? (
            <Button
              size="sm"
              variant="outline"
              className="whitespace-nowrap"
              onClick={() => setEditingRoles((value) => !value)}
              aria-expanded={editingRoles}
            >
              {copy.editRoles}
            </Button>
          ) : null}
        </Td>
      </tr>
      {message || editingRoles ? (
        <tr>
          <td colSpan={columns.length} className="px-3 pb-3">
            {message ? (
              <p
                role={message.tone === 'error' ? 'alert' : 'status'}
                className={
                  message.tone === 'error' ? 'text-xs text-accent-600' : 'text-xs text-green-700'
                }
              >
                {message.text}
              </p>
            ) : null}
            {editingRoles ? (
              <UserRolesEditor
                user={user}
                onSaved={(updated) => {
                  setUser(updated);
                  setEditingRoles(false);
                  setMessage({ tone: 'success', text: copy.rolesSaved });
                  router.refresh();
                }}
                onCancel={() => setEditingRoles(false)}
              />
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}
