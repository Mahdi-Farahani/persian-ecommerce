'use client';

import type { ProductDetail, VariantDetail } from '@pe/shared';
import { useState } from 'react';
import { AddToCartButton } from '@/components/cart/add-to-cart-button';
import { WishlistButton } from '@/components/wishlist/wishlist-button';
import { ImageGallery } from './image-gallery';
import { VariantSelector } from './variant-selector';
import { initialVariant } from './variant-selector';

/**
 * Couples the gallery with the variant selector so choosing a colour swaps
 * to that variant's images. Purchase actions are injected by the caller.
 */
export function ProductPurchasePanel({ product }: { product: ProductDetail }) {
  const [variant, setVariant] = useState<VariantDetail | null>(() =>
    initialVariant(product.variants),
  );
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <ImageGallery
        images={product.images}
        title={product.title}
        preferredImageIds={variant?.imageIds}
      />
      <div className="flex flex-col gap-5">
        <VariantSelector
          product={product}
          onVariantChange={setVariant}
          renderActions={(selected) => (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <AddToCartButton variant={selected} />
              <WishlistButton productId={product.id} variant="labelled" />
            </div>
          )}
        />
      </div>
    </div>
  );
}
