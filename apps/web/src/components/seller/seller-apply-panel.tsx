'use client';

import type { SellerProfileView } from '@pe/shared';
import { useState } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { t } from '@/i18n';
import { SellerApplicationForm } from './seller-application-form';
import { SellerStatusCard } from './seller-status-card';

/**
 * `/seller/apply` body: the application form for newcomers, or the status of
 * an existing application with an inline editor.
 */
export function SellerApplyPanel({ initialProfile }: { initialProfile: SellerProfileView | null }) {
  const [profile, setProfile] = useState(initialProfile);
  const [editing, setEditing] = useState(false);

  const onSaved = (saved: SellerProfileView) => {
    setProfile(saved);
    setEditing(false);
  };

  if (!profile) {
    return (
      <Card>
        <CardTitle>{t.seller.apply.title}</CardTitle>
        <p className="mb-6 text-sm text-ink-muted">{t.seller.apply.subtitle}</p>
        <SellerApplicationForm onSuccess={onSaved} />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SellerStatusCard profile={profile} onEdit={editing ? undefined : () => setEditing(true)} />
      {editing ? (
        <Card>
          <CardTitle>{t.seller.status.editApplication}</CardTitle>
          <SellerApplicationForm
            profile={profile}
            onSuccess={onSaved}
            onCancel={() => setEditing(false)}
          />
        </Card>
      ) : null}
    </div>
  );
}
