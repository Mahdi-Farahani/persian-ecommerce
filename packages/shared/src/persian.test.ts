import { describe, expect, it } from 'vitest';
import {
  formatJalaliNumeric,
  formatToman,
  isValidIranNationalId,
  normalizeIranMobile,
  normalizePersian,
  toEnglishDigits,
  toPersianDigits,
} from './persian.js';
import { isValidSlug, slugify } from './slug.js';

describe('persian helpers', () => {
  it('converts digits both ways', () => {
    expect(toPersianDigits(1405)).toBe('۱۴۰۵');
    expect(toEnglishDigits('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789');
    expect(toEnglishDigits('٠٩١٢')).toBe('0912');
  });

  it('normalises arabic characters', () => {
    expect(normalizePersian('كتاب  يک')).toBe('کتاب یک');
  });

  it('formats toman amounts with persian digits', () => {
    expect(formatToman(1_250_000)).toBe('۱۲۵٬۰۰۰ تومان');
  });

  it('formats jalali dates', () => {
    // 2026-03-21 is 1405/01/01 in the Jalali calendar
    const formatted = formatJalaliNumeric(new Date('2026-03-21T12:00:00Z'));
    expect(toEnglishDigits(formatted).replace(/[^\d/]/g, '')).toBe('1405/01/01');
  });

  it('normalises iranian mobile numbers', () => {
    expect(normalizeIranMobile('+98 912 345 6789')).toBe('09123456789');
    expect(normalizeIranMobile('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789');
    expect(normalizeIranMobile('9123456789')).toBe('09123456789');
    expect(normalizeIranMobile('12345')).toBeNull();
  });

  it('validates national ids', () => {
    expect(isValidIranNationalId('0499370899')).toBe(true);
    expect(isValidIranNationalId('1111111111')).toBe(false);
    expect(isValidIranNationalId('0499370898')).toBe(false);
  });
});

describe('slug', () => {
  it('slugifies persian and english text', () => {
    expect(slugify('گوشی موبایل سامسونگ Galaxy S25')).toBe('گوشی-موبایل-سامسونگ-galaxy-s25');
    expect(slugify('  Hello   World!! ')).toBe('hello-world');
    expect(isValidSlug('hello-world')).toBe(true);
    expect(isValidSlug('hello world')).toBe(false);
    expect(isValidSlug('-hello')).toBe(false);
  });
});
