// Local-time month and financial-year helpers for the money overviews (expenses, other income).
// Stored money dates are saved at 12:00 UTC, so the first 10 characters are the calendar day.
import { toLocalDateInput } from '@/lib/form';

export interface MonthBucket {
  /** yyyy-mm */
  key: string;
  /** "Oct" */
  label: string;
  /** "October 2026" */
  long: string;
}

const monthDate = (offset: number, now: Date) => new Date(now.getFullYear(), now.getMonth() + offset, 1);

/** First day (yyyy-mm-dd) of the month `offset` months from now (0 = this month, -1 = last month). */
export const monthStartYmd = (offset = 0, now = new Date()): string => toLocalDateInput(monthDate(offset, now));

/** Last day (yyyy-mm-dd) of the month `offset` months from now. */
export const monthEndYmd = (offset = 0, now = new Date()): string =>
  toLocalDateInput(new Date(now.getFullYear(), now.getMonth() + offset + 1, 0));

/** "October" / "October 2026" for the month `offset` months from now. */
export const monthName = (offset = 0, withYear = false, now = new Date()): string =>
  monthDate(offset, now).toLocaleDateString('en-IN', withYear ? { month: 'long', year: 'numeric' } : { month: 'long' });

/** The last `n` months, oldest first, ending with the current month. */
export function lastMonths(n: number, now = new Date()): MonthBucket[] {
  return Array.from({ length: n }, (_, i) => {
    const d = monthDate(i - (n - 1), now);
    return {
      key: toLocalDateInput(d).slice(0, 7),
      label: d.toLocaleDateString('en-IN', { month: 'short' }),
      long: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    };
  });
}

/** Indian financial year (1 April – 31 March) containing `now`. */
export function financialYear(now = new Date()): { from: string; to: string; label: string } {
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    from: toLocalDateInput(new Date(startYear, 3, 1)),
    to: toLocalDateInput(new Date(startYear + 1, 2, 31)),
    label: `FY ${startYear}–${String((startYear + 1) % 100).padStart(2, '0')}`,
  };
}

/** Calendar day of a stored money date. */
export const dayOf = (iso: string): string => iso.slice(0, 10);

/** Whole days from `a` to `b` (both yyyy-mm-dd); positive when b is later. */
export function daysBetween(a: string, b: string): number {
  const toUtc = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** Sums `amount` per month bucket. */
export function sumByMonth<T>(rows: T[], months: MonthBucket[], date: (r: T) => string, amount: (r: T) => number): number[] {
  const idx = new Map(months.map((m, i) => [m.key, i]));
  const out = months.map(() => 0);
  for (const r of rows) {
    const i = idx.get(dayOf(date(r)).slice(0, 7));
    if (i !== undefined) out[i] = (out[i] ?? 0) + amount(r);
  }
  return out;
}

/**
 * Month-to-date total for this month and for last month up to the same day, so an early-month
 * figure isn't compared with a whole month.
 */
export function monthToDate<T>(rows: T[], today: string, date: (r: T) => string, amount: (r: T) => number): { current: number; previous: number } {
  const now = new Date(`${today}T12:00:00`);
  const thisStart = monthStartYmd(0, now);
  const lastStart = monthStartYmd(-1, now);
  const lastEnd = monthEndYmd(-1, now);
  const day = Number(today.slice(8, 10));
  const lastCut = `${lastStart.slice(0, 8)}${String(Math.min(day, Number(lastEnd.slice(8, 10)))).padStart(2, '0')}`;
  let current = 0;
  let previous = 0;
  for (const r of rows) {
    const d = dayOf(date(r));
    if (d >= thisStart && d <= today) current += amount(r);
    else if (d >= lastStart && d <= lastCut) previous += amount(r);
  }
  return { current, previous };
}
