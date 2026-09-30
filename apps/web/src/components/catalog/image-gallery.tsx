'use client';

import type { ProductImageSummary } from '@pe/shared';
import Image from 'next/image';
import { useState } from 'react';
import { t } from '@/i18n';
import { assetUrl } from '@/lib/assets';
import { cn } from '@/lib/utils';

interface ImageGalleryProps {
  images: ProductImageSummary[];
  title: string;
  /** Image ids linked to the selected variant; the first one is shown when it changes. */
  preferredImageIds?: string[];
}

export function ImageGallery({ images, title, preferredImageIds = [] }: ImageGalleryProps) {
  // The variant's preferred image wins until the user picks a thumbnail; a
  // change of variant (new preferred key) resets the manual choice.
  const preferred = preferredImageIds.find((id) => images.some((i) => i.id === id)) ?? '';
  const [override, setOverride] = useState<{ key: string; id: string } | null>(null);
  const activeId =
    override && override.key === preferred ? override.id : preferred || images[0]?.id;

  const active = images.find((i) => i.id === activeId) ?? images[0];
  const activeUrl = assetUrl(active?.url);

  if (!active || !activeUrl) {
    return (
      <div className="grid aspect-square place-items-center rounded-card bg-surface-muted text-sm text-ink-muted">
        {t.catalog.noImage}
      </div>
    );
  }
  const activeIndex = images.findIndex((i) => i.id === active.id);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-card border border-border bg-surface">
        <Image
          src={activeUrl}
          alt={active.alt ?? title}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 40vw"
          className="object-contain"
        />
        <span className="sr-only">{t.catalog.imageOf(activeIndex + 1, images.length)}</span>
      </div>
      {images.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label={t.catalog.image}>
          {images.map((image, index) => {
            const url = assetUrl(image.url);
            if (!url) return null;
            const selected = image.id === active.id;
            return (
              <li key={image.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setOverride({ key: preferred, id: image.id })}
                  aria-label={t.catalog.imageOf(index + 1, images.length)}
                  aria-pressed={selected}
                  className={cn(
                    'relative block size-16 overflow-hidden rounded-lg border-2 bg-surface transition',
                    selected ? 'border-brand-600' : 'border-border hover:border-brand-300',
                  )}
                >
                  <Image src={url} alt="" fill sizes="64px" className="object-cover" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
