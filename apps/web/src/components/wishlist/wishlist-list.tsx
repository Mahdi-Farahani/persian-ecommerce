'use client';

import type { WishlistItemView, WishlistView } from '@pe/shared';
import { formatJalaliDate, formatPersianNumber } from '@pe/shared';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Price } from '@/components/catalog/price';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { t } from '@/i18n';
import { errorMessage } from '@/lib/api/error-message';
import { assetUrl } from '@/lib/assets';
import { useWishlistStore } from '@/store/wishlist-store';

type Busy = { productId: string; action: 'move' | 'remove' } | null;

/** Wishlist page body: product cards with "move to cart" and "remove" actions. */
export function WishlistList({ initialWishlist }: { initialWishlist: WishlistView }) {
  const [items, setItems] = useState<WishlistItemView[]>(initialWishlist.items);
  const [busy, setBusy] = useState<Busy>(null);
  const moveToCart = useWishlistStore((state) => state.moveToCart);
  const remove = useWishlistStore((state) => state.remove);
  const setFromView = useWishlistStore((state) => state.setFromView);
  const { notify } = useToast();

  // The server-rendered list is authoritative; keep the global id list in sync.
  useEffect(() => {
    setFromView(initialWishlist);
  }, [initialWishlist, setFromView]);

  const onMove = async (productId: string) => {
    setBusy({ productId, action: 'move' });
    try {
      const result = await moveToCart(productId);
      setItems(result.wishlist.items);
      notify(t.wishlist.movedToCart, {
        tone: 'success',
        action: { label: t.cart.viewCart, href: '/cart' },
      });
    } catch (error) {
      notify(errorMessage(error), { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const onRemove = async (productId: string) => {
    setBusy({ productId, action: 'remove' });
    try {
      const view = await remove(productId);
      setItems(view.items);
      notify(t.wishlist.removed, { tone: 'success' });
    } catch (error) {
      notify(errorMessage(error), { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0) {
    return (
      <Card className="py-16 text-center">
        <p className="text-ink-muted">{t.wishlist.empty}</p>
        <p className="mt-1 text-xs text-ink-muted">{t.wishlist.emptyHint}</p>
        <Link
          href="/products"
          className="mt-4 inline-flex rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700"
        >
          {t.cart.browse}
        </Link>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">
        {t.wishlist.count(formatPersianNumber(items.length))}
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const product = item.product;
          const image = assetUrl(product.image?.url);
          const href = `/products/${product.slug}`;
          const itemBusy = busy?.productId === item.productId ? busy.action : null;
          return (
            <li key={item.productId}>
              <Card className="flex h-full gap-4 p-4">
                <Link
                  href={href}
                  className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-surface-muted"
                >
                  {image ? (
                    <Image
                      src={image}
                      alt={product.image?.alt ?? product.title}
                      fill
                      sizes="96px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="grid h-full place-items-center text-[10px] text-ink-muted">
                      {t.catalog.noImage}
                    </span>
                  )}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <h2 className="line-clamp-2 text-sm font-medium leading-6">
                    <Link href={href} className="hover:text-brand-700">
                      {product.title}
                    </Link>
                  </h2>
                  <p className="text-xs text-ink-muted">
                    {t.wishlist.addedAt} {formatJalaliDate(item.addedAt)}
                  </p>
                  <div className="mt-auto pt-1">
                    {product.inStock ? (
                      <Price
                        amount={product.price}
                        compareAt={product.compareAtPrice}
                        discountPercent={product.discountPercent}
                        size="sm"
                      />
                    ) : (
                      <span className="text-sm text-ink-muted">{t.catalog.outOfStock}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      size="sm"
                      disabled={!product.inStock || itemBusy !== null}
                      loading={itemBusy === 'move'}
                      onClick={() => void onMove(item.productId)}
                    >
                      {itemBusy === 'move' ? t.wishlist.moving : t.wishlist.moveToCart}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-accent-600"
                      disabled={itemBusy !== null}
                      loading={itemBusy === 'remove'}
                      onClick={() => void onRemove(item.productId)}
                    >
                      {t.wishlist.delete}
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
