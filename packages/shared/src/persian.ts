/**
 * Persian locale helpers: digits, number formatting, Jalali dates and
 * text normalisation. All helpers rely only on the ECMAScript Intl API so
 * they run identically in Node.js and the browser.
 */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const;
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] as const;

/** Replaces ASCII digits with Persian (Eastern Arabic-Indic) digits. */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)] ?? d);
}

/** Replaces Persian and Arabic digits with ASCII digits. */
export function toEnglishDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const p = PERSIAN_DIGITS.indexOf(ch as (typeof PERSIAN_DIGITS)[number]);
    if (p >= 0) {
      out += String(p);
      continue;
    }
    const a = ARABIC_DIGITS.indexOf(ch as (typeof ARABIC_DIGITS)[number]);
    out += a >= 0 ? String(a) : ch;
  }
  return out;
}

/**
 * Normalises Persian text for storage and search:
 * Arabic Yeh/Kaf → Persian Yeh/Kaf, removes tatweel and diacritics,
 * converts digits to ASCII and collapses whitespace.
 */
export function normalizePersian(input: string): string {
  return toEnglishDigits(input)
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ٔ/g, '')
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/‌+/g, '‌')
    .replace(/\s+/g, ' ')
    .trim();
}

const faNumber = new Intl.NumberFormat('fa-IR', { useGrouping: true, maximumFractionDigits: 0 });

/** Formats an integer with Persian digits and Persian thousands separators. */
export function formatPersianNumber(value: number): string {
  return faNumber.format(value);
}

/** Formats a rial amount as Toman text, e.g. "۱۲۵٬۰۰۰ تومان". */
export function formatToman(rials: number, unit = 'تومان'): string {
  const toman = Math.floor(rials / 10);
  return `${faNumber.format(toman)} ${unit}`;
}

const jalaliDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const jalaliDateTime = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const jalaliNumeric = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Formats a date in the Jalali (Persian) calendar, e.g. "۱۲ مهر ۱۴۰۵". */
export function formatJalaliDate(date: Date | string | number): string {
  return jalaliDate.format(new Date(date));
}

/** Formats a date and time in the Jalali calendar. */
export function formatJalaliDateTime(date: Date | string | number): string {
  return jalaliDateTime.format(new Date(date));
}

/** Formats a date as numeric Jalali, e.g. "۱۴۰۵/۰۷/۱۲". */
export function formatJalaliNumeric(date: Date | string | number): string {
  return jalaliNumeric.format(new Date(date));
}

/** Iranian mobile numbers: 09xxxxxxxxx (11 digits) after digit normalisation. */
export const IRAN_MOBILE_REGEX = /^09\d{9}$/;

export function normalizeIranMobile(input: string): string | null {
  let digits = toEnglishDigits(input).replace(/[\s-]/g, '');
  if (digits.startsWith('+98')) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith('0098')) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith('98') && digits.length === 12) digits = `0${digits.slice(2)}`;
  else if (digits.startsWith('9') && digits.length === 10) digits = `0${digits}`;
  return IRAN_MOBILE_REGEX.test(digits) ? digits : null;
}

/** Iranian 10-digit postal codes. */
export const IRAN_POSTAL_CODE_REGEX = /^\d{10}$/;

/**
 * Validates an Iranian national ID (کد ملی) using its checksum.
 */
export function isValidIranNationalId(input: string): boolean {
  const id = toEnglishDigits(input).trim();
  if (!/^\d{10}$/.test(id)) return false;
  if (/^(\d)\1{9}$/.test(id)) return false;
  const check = Number(id[9]);
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += Number(id[i]) * (10 - i);
  }
  const remainder = sum % 11;
  return remainder < 2 ? check === remainder : check === 11 - remainder;
}
