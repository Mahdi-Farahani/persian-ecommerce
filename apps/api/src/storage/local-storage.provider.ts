import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { StorageProvider, StoredObject } from './storage.provider.js';

const SAFE_KEY = /^[a-z0-9][a-z0-9/_.-]*$/i;

/**
 * Stores objects on the local disk under `rootDir`; they are served by the
 * API (and nginx in production) under `publicPrefix`.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';

  constructor(
    private readonly rootDir: string,
    private readonly publicPrefix = '/uploads',
  ) {}

  private resolve(key: string): string {
    if (!SAFE_KEY.test(key) || key.includes('..')) {
      throw new Error(`Unsafe storage key: ${key}`);
    }
    return path.join(this.rootDir, key);
  }

  async put(key: string, data: Buffer, contentType: string): Promise<StoredObject> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
    return { key, url: this.urlFor(key), size: data.byteLength, contentType };
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  urlFor(key: string): string {
    return `${this.publicPrefix}/${key}`;
  }
}
