import { discountPercent, moneyFromBigInt } from '@pe/shared';

/** Converts a nullable BIGINT money column to an API number (IRR). */
export function moneyOrNull(value: bigint | null | undefined): number | null {
  return value === null || value === undefined ? null : moneyFromBigInt(value);
}

export function money(value: bigint): number {
  return moneyFromBigInt(value);
}

export function discountOf(compareAt: bigint | null | undefined, price: bigint): number {
  if (compareAt === null || compareAt === undefined) return 0;
  return discountPercent(moneyFromBigInt(compareAt), moneyFromBigInt(price));
}
