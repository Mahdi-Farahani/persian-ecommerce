'use client';

import type { VariantDetail } from '@pe/shared';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { t } from '@/i18n';
import { errorMessage } from '@/lib/api/error-message';
import { useCartStore } from '@/store/cart-store';

export function AddToCartButton({ variant }: { variant: VariantDetail | null }) {
  const add = useCartStore((state) => state.add);
  const { notify } = useToast();
  const [loading, setLoading] = useState(false);
  const disabled = !variant || !variant.inStock;

  const onClick = async () => {
    if (!variant) return;
    setLoading(true);
    try {
      await add(variant.id, 1);
      notify(t.cart.added, { tone: 'success', action: { label: t.cart.viewCart, href: '/cart' } });
    } catch (error) {
      notify(errorMessage(error), { tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      size="lg"
      className="w-full sm:w-auto"
      disabled={disabled}
      loading={loading}
      onClick={onClick}
    >
      {loading ? t.cart.adding : t.cart.addToCart}
    </Button>
  );
}
