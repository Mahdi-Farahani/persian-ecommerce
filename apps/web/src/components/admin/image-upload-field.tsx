'use client';

import Image from 'next/image';
import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { adminFa } from '@/i18n/admin-fa';
import { adminErrorMessage } from '@/lib/admin/errors';
import { uploadImage, validateImageFile } from '@/lib/admin/upload';
import { assetUrl } from '@/lib/assets';

interface ImageUploadFieldProps {
  label: string;
  /** Stored asset path (e.g. `/uploads/catalog/x.webp`) or empty. */
  value: string;
  onChange: (url: string) => void;
  hint?: string;
}

/** Single-image picker: uploads on selection and reports the stored URL. */
export function ImageUploadField({ label, value, onChange, hint }: ImageUploadFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = assetUrl(value);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const invalid = validateImageFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    try {
      const uploaded = await uploadImage(file);
      onChange(uploaded.url);
    } catch (uploadError) {
      setError(adminErrorMessage(uploadError));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
        <span className="ms-1 text-xs font-normal text-ink-muted">({t.common.optional})</span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-muted">
          {preview ? (
            <Image src={preview} alt="" fill sizes="80px" className="object-cover" unoptimized />
          ) : (
            <span className="grid h-full place-items-center text-xs text-ink-muted">
              {t.catalog.noImage}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/*"
            disabled={busy}
            aria-describedby={`${inputId}-hint`}
            onChange={(event) => void onFile(event.target.files?.[0])}
            className="block max-w-xs text-sm file:me-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
          <div className="flex items-center gap-2">
            {busy ? (
              <span className="text-xs text-ink-muted">{adminFa.common.uploading}</span>
            ) : null}
            {value ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-accent-600"
                onClick={() => onChange('')}
              >
                {adminFa.common.removeImage}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-accent-600">
          {error}
        </p>
      ) : (
        <p id={`${inputId}-hint`} className="text-xs text-ink-muted">
          {hint ?? adminFa.common.imageHint}
        </p>
      )}
    </div>
  );
}
