import type { Metadata } from 'next';
import { WishlistList } from '@/components/wishlist/wishlist-list';
import { t } from '@/i18n';
import { requireUser } from '@/lib/auth/server';
import { getWishlist } from '@/lib/wishlist/server';

export const metadata: Metadata = { title: t.wishlist.title, robots: { index: false } };

export default async function AccountWishlistPage() {
  await requireUser('/account/wishlist');
  const wishlist = await getWishlist();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t.wishlist.title}</h1>
      <WishlistList initialWishlist={wishlist} />
    </div>
  );
}
