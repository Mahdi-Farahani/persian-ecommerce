/**
 * Money handling.
 *
 * The canonical monetary unit of the platform is the Iranian Rial (IRR).
 * Every amount is stored and transported as an integer number of rials.
 * Customer-facing surfaces display Toman (1 Toman = 10 Rial) but the
 * conversion happens only at the presentation layer through `toToman`.
 *
 * Floating point numbers are never used for money.
 */

export const CURRENCY_CODE = 'IRR' as const;
export type CurrencyCode = typeof CURRENCY_CODE;

/** Number of rials in one toman. */
export const RIALS_PER_TOMAN = 10;

/**
 * Maximum amount we allow anywhere in the system (rials). Safe well below
 * Number.MAX_SAFE_INTEGER and MariaDB BIGINT so integer arithmetic stays exact.
 */
export const MAX_MONEY_AMOUNT = 9_000_000_000_000_000; // 9e18 rials fits BIGINT, below 2^63

const MAX_SAFE_MONEY = Number.MAX_SAFE_INTEGER;

/** A money amount in rials, always a non-negative safe integer. */
export type Rials = number;

export function isValidMoneyAmount(value: unknown): value is Rials {
  return (
    typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_SAFE_MONEY
  );
}

/** Throws if the value is not a valid non-negative integer rial amount. */
export function assertMoney(value: unknown, label = 'amount'): Rials {
  if (!isValidMoneyAmount(value)) {
    throw new RangeError(`${label} must be a non-negative safe integer number of rials`);
  }
  return value;
}

/** Converts a BigInt coming from the database into a safe integer rial amount. */
export function moneyFromBigInt(value: bigint | number, label = 'amount'): Rials {
  const asNumber = typeof value === 'bigint' ? Number(value) : value;
  if (typeof value === 'bigint' && (value < 0n || value > BigInt(MAX_SAFE_MONEY))) {
    throw new RangeError(`${label} is outside the safe money range`);
  }
  return assertMoney(asNumber, label);
}

export function moneyToBigInt(value: Rials, label = 'amount'): bigint {
  return BigInt(assertMoney(value, label));
}

/** Adds rial amounts with overflow protection. */
export function addMoney(...amounts: Rials[]): Rials {
  let total = 0;
  for (const amount of amounts) {
    total += assertMoney(amount);
    if (total > MAX_SAFE_MONEY) {
      throw new RangeError('money overflow');
    }
  }
  return total;
}

/** Subtracts b from a, clamped at zero (never returns a negative amount). */
export function subtractMoney(a: Rials, b: Rials): Rials {
  const result = assertMoney(a) - assertMoney(b);
  return result < 0 ? 0 : result;
}

/** Multiplies a unit amount by an integer quantity. */
export function multiplyMoney(unit: Rials, quantity: number): Rials {
  assertMoney(unit, 'unit');
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new RangeError('quantity must be a non-negative integer');
  }
  const result = unit * quantity;
  if (result > MAX_SAFE_MONEY) {
    throw new RangeError('money overflow');
  }
  return result;
}

/**
 * Applies a percentage using integer arithmetic (basis points precision).
 * `percent` is expressed in whole percents (0-100). Result is floored.
 */
export function percentOf(amount: Rials, percent: number): Rials {
  assertMoney(amount);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new RangeError('percent must be between 0 and 100');
  }
  const basisPoints = Math.round(percent * 100);
  return Math.floor((amount * basisPoints) / 10_000);
}

/** Converts rials to whole tomans (floor). Used only for display. */
export function toToman(rials: Rials): number {
  return Math.floor(assertMoney(rials) / RIALS_PER_TOMAN);
}

/** Converts tomans (integer) to rials. */
export function fromToman(toman: number): Rials {
  if (!Number.isInteger(toman) || toman < 0) {
    throw new RangeError('toman must be a non-negative integer');
  }
  return multiplyMoney(toman, RIALS_PER_TOMAN);
}

/**
 * Computes the effective discount percentage between a compare-at price
 * and the sale price, rounded to the nearest whole percent.
 */
export function discountPercent(compareAt: Rials, price: Rials): number {
  assertMoney(compareAt, 'compareAt');
  assertMoney(price, 'price');
  if (compareAt === 0 || price >= compareAt) {
    return 0;
  }
  return Math.round(((compareAt - price) * 100) / compareAt);
}
