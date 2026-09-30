import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service.js';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';
const IV_BYTES = 12;
const KEY_BYTES = 32;

/**
 * Derives a 32-byte key from PAYMENT_ENCRYPTION_KEY: accepts 64 hex chars,
 * base64/base64url of 32 bytes, or any longer passphrase (hashed).
 */
export function deriveKey(secret: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(secret)) return Buffer.from(secret, 'hex');
  try {
    const decoded = Buffer.from(secret, 'base64url');
    if (decoded.length === KEY_BYTES) return decoded;
  } catch {
    // fall through to hashing
  }
  return createHash('sha256').update(secret, 'utf8').digest();
}

/** AES-256-GCM encryption for provider credentials stored in the database. */
@Injectable()
export class CredentialsCryptoService {
  private readonly key: Buffer;

  constructor(config: AppConfigService) {
    this.key = deriveKey(config.payments.encryptionKey);
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      VERSION,
      iv.toString('base64url'),
      tag.toString('base64url'),
      ciphertext.toString('base64url'),
    ].join(':');
  }

  decrypt(payload: string): string {
    const [version, ivB64, tagB64, dataB64] = payload.split(':');
    if (version !== VERSION || !ivB64 || !tagB64 || dataB64 === undefined) {
      throw new Error('Unsupported encrypted credential format');
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  encryptJson(value: Record<string, string>): string {
    return this.encrypt(JSON.stringify(value));
  }

  decryptJson(payload: string | null): Record<string, string> {
    if (!payload) return {};
    const parsed: unknown = JSON.parse(this.decrypt(payload));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string') out[key] = value;
    }
    return out;
  }
}

/** Masks a secret for display: last 4 characters visible when long enough. */
export function maskSecret(value: string): string {
  if (value.length <= 6) return '••••••••';
  return `••••••••${value.slice(-4)}`;
}
