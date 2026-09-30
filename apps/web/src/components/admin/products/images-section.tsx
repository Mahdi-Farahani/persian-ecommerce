'use client';

import type { ProductImageSummary } from '@pe/shared';
import Image from 'next/image';
import { useId, useRef, useState } from 'react';
import { Badge } from '@/components/admin/badge';
import type { Notice } from '@/components/admin/notice';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { adminFa } from '@/i18n/admin-fa';
import { adminErrorMessage } from '@/lib/admin/errors';
import type { UploadedImage } from '@/lib/admin/types';
import { uploadImage, validateImageFile } from '@/lib/admin/upload';
import { assetUrl } from '@/lib/assets';

export interface ImageActions {
  add: (uploaded: UploadedImage) => Promise<void>;
  remove: (imageId: string) => Promise<void>;
  setPrimary: (imageId: string) => Promise<void>;
  reorder: (imageIds: string[]) => Promise<void>;
}

interface ImagesSectionProps {
  images: ProductImageSummary[];
  actions: ImageActions;
  readOnly: boolean;
}

const copy = adminFa.products.images;

function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

/** Thumbnail grid with upload, primary selection, ordering and deletion. */
export function ImagesSection({ images, actions, readOnly }: ImagesSectionProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);

  const run = async (task: () => Promise<void>, success?: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await task();
      if (success) setNotice({ tone: 'success', message: success });
    } catch (error) {
      setNotice({ tone: 'error', message: adminErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    const invalid = list.map(validateImageFile).find((message) => message !== null);
    if (invalid) {
      setNotice({ tone: 'error', message: invalid });
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    await run(async () => {
      for (const file of list) {
        const uploaded = await uploadImage(file);
        await actions.add(uploaded);
      }
    }, copy.uploaded);
    if (inputRef.current) inputRef.current.value = '';
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sorted.length) return;
    const ids = moveItem(sorted, index, target).map((image) => image.id);
    void run(() => actions.reorder(ids), copy.reordered);
  };

  return (
    <div className="flex flex-col gap-4">
      {notice ? <Alert tone={notice.tone}>{notice.message}</Alert> : null}
      {readOnly ? null : (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={inputId} className="text-sm font-medium">
            {copy.upload}
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/*"
            multiple
            disabled={busy}
            onChange={(event) => void onFiles(event.target.files)}
            className="block max-w-sm text-sm file:me-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
          <p className="text-xs text-ink-muted">
            {busy ? adminFa.common.uploading : adminFa.common.imageHint}
          </p>
        </div>
      )}
      {sorted.length === 0 ? (
        <p className="text-sm text-ink-muted">{copy.empty}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sorted.map((image, index) => {
            const src = assetUrl(image.url);
            return (
              <li
                key={image.id}
                className="flex flex-col gap-2 rounded-lg border border-border p-2"
              >
                <div className="relative aspect-square overflow-hidden rounded-md bg-surface-muted">
                  {src ? (
                    <Image
                      src={src}
                      alt={image.alt ?? ''}
                      fill
                      sizes="200px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : null}
                  {image.isPrimary ? (
                    <Badge tone="info" className="absolute start-2 top-2">
                      {copy.primary}
                    </Badge>
                  ) : null}
                </div>
                {readOnly ? null : (
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy || index === 0}
                      aria-label={adminFa.common.moveUp}
                      title={adminFa.common.moveUp}
                      onClick={() => move(index, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy || index === sorted.length - 1}
                      aria-label={adminFa.common.moveDown}
                      title={adminFa.common.moveDown}
                      onClick={() => move(index, 1)}
                    >
                      ↓
                    </Button>
                    {!image.isPrimary ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void run(() => actions.setPrimary(image.id))}
                      >
                        {copy.setPrimary}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ms-auto text-accent-600"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(adminFa.common.deleteConfirm))
                          void run(() => actions.remove(image.id));
                      }}
                    >
                      {t.common.delete}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
