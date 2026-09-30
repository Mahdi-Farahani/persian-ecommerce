'use client';

import { toPersianDigits } from '@pe/shared';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { t } from '@/i18n';
import { browserApi } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/error-message';
import type { Address } from '@/lib/types/address';
import { AddressForm } from './address-form';

type Mode = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; address: Address };

export function AddressBook({ initialAddresses }: { initialAddresses: Address[] }) {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const reload = async () => {
    setAddresses(await browserApi.get<Address[]>('/users/me/addresses'));
  };

  const onSaved = async () => {
    setMode({ kind: 'list' });
    setNotice({ tone: 'success', message: t.account.addressSaved });
    await reload();
  };

  const onDelete = async (address: Address) => {
    if (!window.confirm(t.account.deleteAddressConfirm)) return;
    try {
      await browserApi.delete(`/users/me/addresses/${address.id}`);
      setNotice({ tone: 'success', message: t.account.addressDeleted });
      await reload();
    } catch (error) {
      setNotice({ tone: 'error', message: errorMessage(error) });
    }
  };

  const onSetDefault = async (address: Address) => {
    try {
      await browserApi.patch(`/users/me/addresses/${address.id}`, { isDefault: true });
      await reload();
    } catch (error) {
      setNotice({ tone: 'error', message: errorMessage(error) });
    }
  };

  if (mode.kind !== 'list') {
    return (
      <Card>
        <h2 className="mb-4 text-lg font-bold">
          {mode.kind === 'edit' ? t.account.editAddress : t.account.addAddress}
        </h2>
        <AddressForm
          address={mode.kind === 'edit' ? mode.address : undefined}
          onSaved={onSaved}
          onCancel={() => setMode({ kind: 'list' })}
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {notice ? <Alert tone={notice.tone}>{notice.message}</Alert> : null}
      <div>
        <Button onClick={() => setMode({ kind: 'create' })}>{t.account.addAddress}</Button>
      </div>
      {addresses.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-muted">{t.account.addressesEmpty}</p>
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id}>
              <Card className="flex h-full flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">{address.title}</h3>
                  {address.isDefault ? (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                      {t.account.defaultAddress}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm">
                  {address.province}، {address.city}، {address.addressLine}
                </p>
                <p className="text-sm text-ink-muted">
                  {t.account.address.postalCode}:{' '}
                  <span dir="ltr">{toPersianDigits(address.postalCode)}</span>
                </p>
                <p className="text-sm text-ink-muted">
                  {address.recipientName} —{' '}
                  <span dir="ltr">{toPersianDigits(address.recipientPhone)}</span>
                </p>
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMode({ kind: 'edit', address })}
                  >
                    {t.common.edit}
                  </Button>
                  {!address.isDefault ? (
                    <Button size="sm" variant="ghost" onClick={() => onSetDefault(address)}>
                      {t.account.setDefault}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-accent-600"
                    onClick={() => onDelete(address)}
                  >
                    {t.common.delete}
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
