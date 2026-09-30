'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, type MouseEvent } from 'react';
import { useToast } from '@/components/ui/toast';
import { t } from '@/i18n';
import { errorMessage } from '@/lib/api/error-message';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useWishlistStore } from '@/store/wishlist-store';

interface WishlistButtonProps {
  productId: string;
  /** `icon` is a compact round button (cards); `labelled` shows text next to the heart. */
  variant?: 'icon' | 'labelled';
  className?: string;
}

/**
 * Heart toggle for the wishlist. Guests are sent to the login page with a
 * return path; signed-in users toggle optimistically through the store.
 * Click events never bubble so the button can sit on top of card links.
 */
export function WishlistButton({ productId, variant = 'icon', className }: WishlistButtonProps) {
  const user = useAuthStore((state) => state.user);
  const inWishlist = useWishlistStore((state) => state.ids.includes(productId));
  const toggle = useWishlistStore((state) => state.toggle);
  const { notify } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const label = inWishlist ? t.wishlist.remove : t.wishlist.add;

  const onClick = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!user) {
      notify(t.wishlist.loginRequired, { tone: 'info' });
      router.push(`/login?next=${encodeURIComponent(pathname || '/')}`);
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const added = await toggle(productId);
      notify(added ? t.wishlist.added : t.wishlist.removed, {
        tone: 'success',
        action: added ? { label: t.wishlist.view, href: '/account/wishlist' } : undefined,
      });
    } catch (error) {
      notify(errorMessage(error), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      aria-pressed={inWishlist}
      aria-label={variant === 'icon' ? label : undefined}
      title={variant === 'icon' ? label : undefined}
      disabled={busy}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg border transition disabled:cursor-wait',
        inWishlist
          ? 'border-accent-500/40 bg-red-50 text-accent-600'
          : 'border-border bg-surface text-ink-muted hover:border-accent-500/40 hover:text-accent-600',
        variant === 'icon' ? 'size-9 rounded-full shadow-sm' : 'h-12 px-4 text-sm font-medium',
        className,
      )}
    >
      <HeartIcon filled={inWishlist} />
      {variant === 'labelled' ? <span>{label}</span> : null}
    </button>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.5 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.5 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"
        strokeLinejoin="round"
      />
    </svg>
  );
}
