import { adminFa } from '@/i18n/admin-fa';
import { browserApi } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { env } from '@/lib/env';
import type { UploadedImage } from './types';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Client-side pre-check so obvious mistakes never hit the network. */
export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return adminFa.products.images.notImage;
  if (file.size > MAX_IMAGE_BYTES) return adminFa.products.images.tooLarge;
  return null;
}

async function send(file: File): Promise<Response> {
  const form = new FormData();
  form.append('file', file);
  const base = env.publicApiUrl.replace(/\/+$/, '');
  try {
    return await fetch(`${base}/admin/uploads/images`, {
      method: 'POST',
      body: form,
      credentials: 'include',
      headers: { Accept: 'application/json', 'X-Requested-With': 'fetch' },
    });
  } catch (error) {
    throw new ApiError(0, 'NETWORK_ERROR', 'ارتباط با سرور برقرار نشد', error);
  }
}

/**
 * Uploads an image through the multipart endpoint (the JSON client cannot
 * send FormData). Retries once after refreshing the session on 401.
 */
export async function uploadImage(file: File): Promise<UploadedImage> {
  let response = await send(file);
  if (response.status === 401) {
    const refreshed = await browserApi
      .post('/auth/refresh', {})
      .then(() => true)
      .catch(() => false);
    if (refreshed) response = await send(file);
  }
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) throw ApiError.fromBody(response.status, payload);
  return payload as UploadedImage;
}
