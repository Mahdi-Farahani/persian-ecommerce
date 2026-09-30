import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import sharp, { type Metadata } from 'sharp';
import { UnprocessableAppException } from '../common/errors/app.exception.js';
import { STORAGE_PROVIDER, type StorageProvider, type StoredObject } from './storage.provider.js';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;
const ALLOWED_INPUT_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'avif']);

export interface ImageUploadResult extends StoredObject {
  width: number;
  height: number;
}

/**
 * Validates and normalises uploaded images before handing them to storage.
 * Every image is decoded with sharp (so the content, not the extension or
 * the client-provided MIME type, is what gets validated), re-encoded as WebP
 * and downscaled to a sane maximum dimension. Metadata (EXIF, GPS) is dropped.
 */
@Injectable()
export class StorageService {
  constructor(@Inject(STORAGE_PROVIDER) private readonly provider: StorageProvider) {}

  get providerName(): string {
    return this.provider.name;
  }

  async storeImage(data: Buffer, folder: string): Promise<ImageUploadResult> {
    if (data.byteLength === 0 || data.byteLength > MAX_IMAGE_BYTES) {
      throw new UnprocessableAppException(
        'IMAGE_TOO_LARGE',
        `حجم تصویر باید حداکثر ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} مگابایت باشد`,
      );
    }
    let pipeline = sharp(data, { failOn: 'error', limitInputPixels: 40_000_000 });
    let metadata: Metadata;
    try {
      metadata = await pipeline.metadata();
    } catch {
      throw new UnprocessableAppException('IMAGE_INVALID', 'فایل ارسال‌شده یک تصویر معتبر نیست');
    }
    if (!metadata.format || !ALLOWED_INPUT_FORMATS.has(metadata.format)) {
      throw new UnprocessableAppException(
        'IMAGE_FORMAT_UNSUPPORTED',
        'فرمت تصویر پشتیبانی نمی‌شود (JPEG، PNG، WebP، GIF، AVIF)',
      );
    }
    pipeline = pipeline.rotate().resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    });
    const output = await pipeline.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    const key = `${sanitizeFolder(folder)}/${randomUUID()}.webp`;
    const stored = await this.provider.put(key, output.data, 'image/webp');
    return { ...stored, width: output.info.width, height: output.info.height };
  }

  async remove(key: string): Promise<void> {
    await this.provider.delete(key);
  }
}

function sanitizeFolder(folder: string): string {
  const cleaned = folder.replace(/[^a-z0-9/_-]/gi, '').replace(/^\/+|\/+$/g, '');
  return cleaned || 'misc';
}
