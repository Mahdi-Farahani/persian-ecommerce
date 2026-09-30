import { formatPersianNumber, type DashboardMetrics } from '@pe/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { adminFa } from '@/i18n/admin-fa';
import { KpiCards } from './kpi-cards';
import { compactToman, niceCeiling, SalesChart } from './sales-chart';

const copy = adminFa.dashboard;

const sales: DashboardMetrics['sales'] = {
  today: { orders: 2, revenue: 5_600_000, averageOrderValue: 2_800_000 },
  last7Days: { orders: 12, revenue: 84_000_000, averageOrderValue: 7_000_000 },
  last30Days: { orders: 40, revenue: 400_000_000, averageOrderValue: 10_000_000 },
  allTime: { orders: 100, revenue: 1_000_000_000, averageOrderValue: 10_000_000 },
};

const dailySales: DashboardMetrics['dailySales'] = Array.from({ length: 14 }, (_, index) => {
  const day = String(index + 1).padStart(2, '0');
  const revenue = index === 13 ? 28_000_000 : index === 6 ? 14_000_000 : 0;
  return { date: `2026-09-${day}`, orders: revenue > 0 ? 1 : 0, revenue };
});

describe('KpiCards', () => {
  it('renders one card per window with revenue and averages in Toman', () => {
    render(<KpiCards sales={sales} />);

    const today = screen.getByTestId(`kpi-${copy.windows.today}`);
    expect(within(today).getByText(formatPersianNumber(560_000))).toBeInTheDocument();
    expect(within(today).getByText(formatPersianNumber(280_000))).toBeInTheDocument();
    expect(within(today).getByText(formatPersianNumber(2))).toBeInTheDocument();

    const month = screen.getByTestId(`kpi-${copy.windows.last30Days}`);
    expect(within(month).getByText(formatPersianNumber(40_000_000))).toBeInTheDocument();
    expect(within(month).getByText(formatPersianNumber(40))).toBeInTheDocument();
    expect(screen.queryByText(formatPersianNumber(100_000_000))).not.toBeInTheDocument();
  });
});

describe('SalesChart', () => {
  it('draws one bar per day scaled to a nice ceiling', () => {
    render(<SalesChart points={dailySales} />);

    const bars = screen.getAllByTestId('sales-bar');
    expect(bars).toHaveLength(14);

    // 2,800,000 Toman on a 5,000,000 ceiling => 56% tall.
    const tallest = bars[13]?.querySelector('[data-revenue]') as HTMLElement;
    expect(tallest).toHaveAttribute('data-revenue', '2800000');
    expect(tallest.style.height).toBe('56%');
    const half = bars[6]?.querySelector('[data-revenue]') as HTMLElement;
    expect(half.style.height).toBe('28%');
    const empty = bars[0]?.querySelector('[data-revenue]') as HTMLElement;
    expect(empty).toHaveAttribute('data-revenue', '0');
    expect(empty.style.height).toBe('');

    // Each bar is keyboard reachable and describes its values in Persian.
    expect(tallest).toHaveAttribute('tabindex', '0');
    expect(tallest.getAttribute('aria-label')).toContain(formatPersianNumber(2_800_000));

    // A screen-reader table lists every day.
    const table = screen.getByRole('table', { name: copy.chart.tableCaption });
    expect(within(table).getAllByRole('row')).toHaveLength(15);
    expect(screen.queryByText(copy.chart.empty)).not.toBeInTheDocument();
  });

  it('shows the empty message when nothing was sold', () => {
    render(
      <SalesChart points={dailySales.map((point) => ({ ...point, revenue: 0, orders: 0 }))} />,
    );
    expect(screen.getByText(copy.chart.empty)).toBeInTheDocument();
    expect(screen.getAllByTestId('sales-bar')).toHaveLength(14);
  });

  it('computes nice ceilings and compact Toman labels', () => {
    expect(niceCeiling(0)).toBe(1);
    expect(niceCeiling(2_800_000)).toBe(5_000_000);
    expect(niceCeiling(1_000)).toBe(1_000);
    expect(niceCeiling(1_100)).toBe(2_000);
    expect(niceCeiling(230)).toBe(250);
    expect(compactToman(2_500_000)).toBe(`۲٫۵ ${copy.chart.units.million}`);
    expect(compactToman(1_000_000_000)).toBe(`۱ ${copy.chart.units.billion}`);
    expect(compactToman(750)).toBe('۷۵۰');
  });
});
