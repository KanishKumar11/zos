// Day helpers for the payments views — grouping payouts by the day they were paid, friendly day
// labels and calendar-heatmap totals. Payout dates are stored at noon UTC of the day the owner
// entered, so the first 10 characters are the paid day in every timezone.
import { todayLocal, toLocalDateInput } from '@/lib/form';

import type { HeatDay } from '@/components/viz';

import type { PayoutRow } from './payouts.hooks';

/** yyyy-mm-dd the payment was made. */
export const payDay = (p: Pick<PayoutRow, 'paidAt'>): string => String(p.paidAt).slice(0, 10);

const ymdToDate = (ymd: string): Date => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};

/** "Today", "Yesterday", "Mon 28 Sep" (adds the year when it isn't this year). */
export function dayLabel(ymd: string): string {
  const today = todayLocal();
  if (ymd === today) return 'Today';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (ymd === toLocalDateInput(y)) return 'Yesterday';
  const date = ymdToDate(ymd);
  const sameYear = ymd.slice(0, 4) === today.slice(0, 4);
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' });
  const rest = date.toLocaleDateString('en-GB', sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
  return `${weekday} ${rest}`;
}

export interface PayoutDay {
  day: string;
  label: string;
  totalPaise: number;
  items: PayoutRow[];
}

/** Groups payouts by paid day, newest day first, keeping each day's order as given. */
export function groupByDay(rows: PayoutRow[]): PayoutDay[] {
  const map = new Map<string, PayoutRow[]>();
  for (const r of rows) {
    const key = payDay(r);
    const list = map.get(key);
    if (list) list.push(r);
    else map.set(key, [r]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([day, items]) => ({ day, label: dayLabel(day), totalPaise: items.reduce((s, r) => s + r.amountPaise, 0), items }));
}

/** Paid-out totals per day for <CalendarHeatmap split={false}> (series `a`). */
export function heatDays(rows: PayoutRow[]): HeatDay[] {
  const map = new Map<string, number>();
  for (const r of rows) map.set(payDay(r), (map.get(payDay(r)) ?? 0) + r.amountPaise);
  return [...map.entries()].map(([date, a]) => ({ date, a }));
}

/** First day shown by a `weeks`-wide CalendarHeatmap ending this week (the Monday `weeks - 1` weeks ago). */
export function heatWindowStart(weeks: number): string {
  const start = new Date();
  const dow = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dow - (weeks - 1) * 7);
  return toLocalDateInput(start);
}

/** First day of the current month, local time. */
export const monthStartLocal = (): string => `${todayLocal().slice(0, 7)}-01`;

/** Last `count` months as yyyy-mm keys, oldest first (ending with this month). */
export function lastMonths(count: number): string[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

export const monthLabel = (ym: string, withYear = false): string =>
  ymdToDate(`${ym}-01`).toLocaleDateString('en-GB', withYear ? { month: 'short', year: 'numeric' } : { month: 'short' });
