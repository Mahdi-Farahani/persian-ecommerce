export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export interface StoredObject {
  /** Provider-specific key (path inside the bucket / uploads root). */
  key: string;
  /** Public URL (absolute, or root-relative when served by the platform). */
  url: string;
  size: number;
  contentType: string;
}

/**
 * Object storage abstraction. Business code never touches the file system or
 * a cloud SDK directly; providers implement this contract.
 */
export interface StorageProvider {
  readonly name: string;
  put(key: string, data: Buffer, contentType: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
  urlFor(key: string): string;
}
