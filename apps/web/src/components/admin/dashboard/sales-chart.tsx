import { formatJalaliDate, formatPersianNumber, toToman, type DailySalesPoint } from '@pe/shared';
import { Card, CardTitle } from '@/components/ui/card';
import { adminFa } from '@/i18n/admin-fa';
import { cn } from '@/lib/utils';

const copy = adminFa.dashboard.chart;
const TICK_COUNT = 4;
const THOUSAND = 1_000;
const MILLION = 1_000_000;
const BILLION = 1_000_000_000;

const compactNumber = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });
const dayLabel = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric' });
const dayMonthLabel = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  day: 'numeric',
  month: 'short',
});

/** Rounds a maximum up to a "nice" axis ceiling (1 / 2 / 2.5 / 5 / 10 × 10^n). */
export function niceCeiling(max: number): number {
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const fraction = max / magnitude;
  const nice =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * magnitude;
}

/** Compact Toman label for axis ticks, e.g. "۲٫۸ میلیون". */
export function compactToman(toman: number): string {
  const units = copy.units;
  if (toman >= BILLION) return `${compactNumber.format(toman / BILLION)} ${units.billion}`;
  if (toman >= MILLION) return `${compactNumber.format(toman / MILLION)} ${units.million}`;
  if (toman >= THOUSAND) return `${compactNumber.format(toman / THOUSAND)} ${units.thousand}`;
  return compactNumber.format(toman);
}

/** Interprets the ISO calendar day at local noon so the Jalali label never shifts a day. */
function dayDate(isoDay: string): Date {
  return new Date(`${isoDay}T12:00:00`);
}

interface SalesChartProps {
  points: DailySalesPoint[];
}

/**
 * Daily revenue as a single-series column chart built from HTML/CSS: bars grow
 * from a shared baseline, gridlines are hairlines, and each column exposes its
 * values through a hover/focus tooltip plus a visually hidden table.
 */
export function SalesChart({ points }: SalesChartProps) {
  const revenues = points.map((point) => toToman(point.revenue));
  const maxRevenue = Math.max(0, ...revenues);
  const ceiling = niceCeiling(maxRevenue);
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => (ceiling * i) / TICK_COUNT);
  const hasSales = maxRevenue > 0;

  return (
    <Card>
      <CardTitle className="mb-1">{copy.title}</CardTitle>
      <p className="mb-4 text-xs text-ink-muted">{copy.description}</p>
      <div className="flex gap-2" dir="ltr">
        <div className="relative flex h-56 w-16 shrink-0 flex-col-reverse justify-between text-[11px] text-ink-muted">
          {ticks.map((tick) => (
            <span key={tick} className="leading-none tabular-nums" dir="rtl">
              {compactToman(tick)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="relative h-56">
            <div
              aria-hidden="true"
              className="absolute inset-0 flex flex-col-reverse justify-between"
            >
              {ticks.map((tick) => (
                <div key={tick} className="h-px w-full bg-border" />
              ))}
            </div>
            {!hasSales ? (
              <p className="absolute inset-0 grid place-items-center text-sm text-ink-muted">
                {copy.empty}
              </p>
            ) : null}
            <ol className="absolute inset-0 flex items-end justify-around gap-1 px-1">
              {points.map((point, index) => {
                const revenue = revenues[index] ?? 0;
                const height = Math.round((revenue / ceiling) * 100 * 100) / 100;
                const label = copy.pointLabel(
                  formatJalaliDate(dayDate(point.date)),
                  formatPersianNumber(revenue),
                  formatPersianNumber(point.orders),
                );
                return (
                  <li
                    key={point.date}
                    className="group relative flex h-full flex-1 items-end justify-center"
                    data-testid="sales-bar"
                  >
                    <div
                      tabIndex={0}
                      aria-label={label}
                      className={cn(
                        'w-full max-w-6 rounded-t-[4px] bg-brand-600 outline-none transition group-hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-300',
                        revenue === 0 && 'h-px bg-border',
                      )}
                      style={revenue > 0 ? { height: `${height}%` } : undefined}
                      data-revenue={revenue}
                    />
                    <div
                      role="tooltip"
                      dir="rtl"
                      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-white group-hover:block group-focus-within:block"
                    >
                      <p className="font-medium">{formatJalaliDate(dayDate(point.date))}</p>
                      <p>
                        {copy.revenue}: {formatPersianNumber(revenue)}
                      </p>
                      <p>
                        {copy.orders}: {formatPersianNumber(point.orders)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
          <ol
            aria-hidden="true"
            className="mt-2 flex justify-around gap-1 px-1 text-[11px] text-ink-muted"
          >
            {points.map((point, index) => {
              const date = dayDate(point.date);
              const showMonth = index === 0 || index === points.length - 1;
              return (
                <li
                  key={point.date}
                  className={cn(
                    'flex-1 text-center whitespace-nowrap tabular-nums',
                    index % 2 === 1 && 'hidden sm:block',
                  )}
                >
                  {showMonth ? dayMonthLabel.format(date) : dayLabel.format(date)}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <table className="sr-only">
        <caption>{copy.tableCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{copy.day}</th>
            <th scope="col">{copy.revenue}</th>
            <th scope="col">{copy.orders}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point, index) => (
            <tr key={point.date}>
              <th scope="row">{formatJalaliDate(dayDate(point.date))}</th>
              <td>{formatPersianNumber(revenues[index] ?? 0)}</td>
              <td>{formatPersianNumber(point.orders)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
