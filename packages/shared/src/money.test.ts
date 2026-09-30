import { describe, expect, it } from 'vitest';
import {
  addMoney,
  assertMoney,
  discountPercent,
  fromToman,
  moneyFromBigInt,
  multiplyMoney,
  percentOf,
  subtractMoney,
  toToman,
} from './money.js';

describe('money', () => {
  it('accepts non-negative integers only', () => {
    expect(assertMoney(0)).toBe(0);
    expect(assertMoney(1_500_000)).toBe(1_500_000);
    expect(() => assertMoney(1.5)).toThrow(RangeError);
    expect(() => assertMoney(-1)).toThrow(RangeError);
    expect(() => assertMoney('10')).toThrow(RangeError);
    expect(() => assertMoney(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });

  it('adds and subtracts with clamping', () => {
    expect(addMoney(100, 200, 300)).toBe(600);
    expect(subtractMoney(100, 30)).toBe(70);
    expect(subtractMoney(30, 100)).toBe(0);
  });

  it('multiplies by quantity', () => {
    expect(multiplyMoney(250_000, 4)).toBe(1_000_000);
    expect(() => multiplyMoney(250_000, 1.5)).toThrow(RangeError);
    expect(() => multiplyMoney(Number.MAX_SAFE_INTEGER, 2)).toThrow(RangeError);
  });

  it('computes percentages with integer arithmetic', () => {
    expect(percentOf(1_000_000, 15)).toBe(150_000);
    expect(percentOf(999, 33.33)).toBe(332);
    expect(() => percentOf(100, 101)).toThrow(RangeError);
  });

  it('converts between rial and toman', () => {
    expect(toToman(1_250_000)).toBe(125_000);
    expect(toToman(9)).toBe(0);
    expect(fromToman(125_000)).toBe(1_250_000);
  });

  it('computes discount percent', () => {
    expect(discountPercent(1_000_000, 800_000)).toBe(20);
    expect(discountPercent(1_000_000, 1_000_000)).toBe(0);
    expect(discountPercent(0, 0)).toBe(0);
  });

  it('converts bigint from the database', () => {
    expect(moneyFromBigInt(1_000n)).toBe(1000);
    expect(() => moneyFromBigInt(-1n)).toThrow(RangeError);
  });
});
