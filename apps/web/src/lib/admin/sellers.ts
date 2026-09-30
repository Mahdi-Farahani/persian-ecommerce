import {
  MAX_COMMISSION_BPS,
  formatJalaliDate,
  toEnglishDigits,
  type SellerStatus,
  type SettlementStatus,
} from '@pe/shared';
import { adminFa } from '@/i18n/admin-fa';

/** Basis points per percent (100 bps = 1%). */
export const BPS_PER_PERCENT = 100;

/** Highest commission the admin may set, as a percent (50). */
export const MAX_COMMISSION_PERCENT = MAX_COMMISSION_BPS / BPS_PER_PERCENT;

const percentFormatter = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });

/** Converts basis points to a percent number, e.g. 1250 -> 12.5. */
export function bpsToPercent(bps: number): number {
  return bps / BPS_PER_PERCENT;
}

/** Converts a percent (up to two decimals) to integer basis points, e.g. 12.5 -> 1250. */
export function percentToBps(percent: number): number {
  return Math.round(percent * BPS_PER_PERCENT);
}

/** Formats basis points as a Persian percent, e.g. 1250 -> "۱۲٫۵٪". */
export function formatCommissionPercent(bps: number): string {
  return `${percentFormatter.format(bpsToPercent(bps))}٪`;
}

/**
 * Parses a decimal typed by the admin (Persian digits, Persian decimal
 * separator or comma accepted). Returns NaN for anything that is not a number.
 */
export function parseDecimalInput(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const text = toEnglishDigits(String(raw)).replace(/[٫,]/g, '.').replace(/\s/g, '');
  if (text === '') return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

/** True when the number has at most two decimal places. */
export function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * BPS_PER_PERCENT - Math.round(value * BPS_PER_PERCENT)) < 1e-9;
}

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const sellerStatusTones: Record<SellerStatus, Tone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  SUSPENDED: 'danger',
  REJECTED: 'neutral',
};

const settlementStatusTones: Record<SettlementStatus, Tone> = {
  PENDING: 'warning',
  PAID: 'success',
  CANCELLED: 'neutral',
};

export function sellerStatusTone(status: SellerStatus): Tone {
  return sellerStatusTones[status] ?? 'neutral';
}

export function settlementStatusTone(status: SettlementStatus): Tone {
  return settlementStatusTones[status] ?? 'neutral';
}

/** Sale period covered by a settlement batch, or a label when it has no dated items. */
export function settlementPeriod(periodStart: string | null, periodEnd: string | null): string {
  if (!periodStart || !periodEnd) return adminFa.settlements.noPeriod;
  const from = formatJalaliDate(periodStart);
  const to = formatJalaliDate(periodEnd);
  return from === to ? from : adminFa.settlements.periodRange(from, to);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns the id when it looks like a UUID (the API rejects anything else). */
export function pickUuid(value: string | undefined): string {
  const trimmed = value?.trim() ?? '';
  return UUID_REGEX.test(trimmed) ? trimmed : '';
}
