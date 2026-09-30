import { AddressBook } from '@/components/account/address-book';
import { t } from '@/i18n';
import { requireUser } from '@/lib/auth/server';
import { serverApi } from '@/lib/api/server';
import type { Address } from '@/lib/types/address';

export default async function AccountAddressesPage() {
  await requireUser('/account/addresses');
  const addresses = await serverApi<Address[]>('/users/me/addresses', { cache: 'no-store' });
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{t.account.addressesTitle}</h1>
      <AddressBook initialAddresses={addresses} />
    </div>
  );
}
