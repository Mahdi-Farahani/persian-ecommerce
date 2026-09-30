import { formatPersianNumber, toToman, type DashboardMetrics, type SalesWindow } from '@pe/shared';
import { Card } from '@/components/ui/card';
import { adminFa } from '@/i18n/admin-fa';

const copy = adminFa.dashboard;

const WINDOWS = [
  { key: 'today', label: copy.windows.today },
  { key: 'last7Days', label: copy.windows.last7Days },
  { key: 'last30Days', label: copy.windows.last30Days },
] as const;

function Metric({ label, value, hero }: { label: string; value: string; hero?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className={hero ? 'mt-1 text-2xl font-bold' : 'mt-0.5 text-base font-semibold'}>
        {value}
      </dd>
    </div>
  );
}

function WindowCard({ label, window }: { label: string; window: SalesWindow }) {
  return (
    <Card data-testid={`kpi-${label}`}>
      <p className="text-sm font-bold">{label}</p>
      <dl className="mt-3 grid gap-3">
        <Metric
          label={copy.kpi.revenue}
          value={formatPersianNumber(toToman(window.revenue))}
          hero
        />
        <div className="grid grid-cols-2 gap-3">
          <Metric label={copy.kpi.orders} value={formatPersianNumber(window.orders)} />
          <Metric
            label={copy.kpi.averageOrderValue}
            value={formatPersianNumber(toToman(window.averageOrderValue))}
          />
        </div>
      </dl>
    </Card>
  );
}

/** Sales KPIs for today / last 7 days / last 30 days. Money shown in Toman. */
export function KpiCards({ sales }: { sales: DashboardMetrics['sales'] }) {
  return (
    <section aria-label={copy.sales} className="grid gap-4 md:grid-cols-3">
      {WINDOWS.map((item) => (
        <WindowCard key={item.key} label={item.label} window={sales[item.key]} />
      ))}
    </section>
  );
}
