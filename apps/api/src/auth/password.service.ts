import { Injectable } from '@nestjs/common';
import argon2, { type HashOptions } from 'argon2';

/**
 * Password hashing with Argon2id (OWASP recommended parameters).
 */
@Injectable()
export class PasswordService {
  private readonly options: HashOptions = {
    type: argon2.argon2id,
    memoryCost: 19_456, // 19 MiB
    timeCost: 2,
    parallelism: 1,
  };

  /** Pre-computed hash used to equalise timing when the user does not exist. */
  private dummyHash?: string;

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.options);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /** Spends the same time as a real verification so user enumeration by timing is harder. */
  async verifyDummy(plain: string): Promise<void> {
    this.dummyHash ??= await this.hash('dummy-password-for-timing-equalisation');
    await this.verify(this.dummyHash, plain);
  }
}
