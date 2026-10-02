// Date-range presets used by list filters and the dashboard. All ranges are local-time
// yyyy-mm-dd strings, inclusive. Financial year runs April → March (India).
import { toLocalDateInput } from './form';

export type RangePreset =
  | 'this-month'
  | 'last-month'
  | 'this-quarter'
  | 'this-fy'
  | 'last-fy'
  | 'last-30'
  | 'all'
  | 'custom';

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'last-30', label: 'Last 30 days' },
  { value: 'this-quarter', label: 'This quarter' },
  { value: 'this-fy', label: 'This financial year' },
  { value: 'last-fy', label: 'Last financial year' },
  { value: 'custom', label: 'Custom range…' },
];

const d = (y: number, m: number, day: number) => toLocalDateInput(new Date(y, m, day));

/** First month (0-based) of the Indian FY containing `date`. */
const fyStartYear = (date: Date) => (date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1);

export function presetRange(preset: RangePreset, now = new Date()): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case 'this-month':
      return { from: d(y, m, 1), to: d(y, m + 1, 0) };
    case 'last-month':
      return { from: d(y, m - 1, 1), to: d(y, m, 0) };
    case 'last-30':
      return { from: toLocalDateInput(new Date(now.getTime() - 29 * 86_400_000)), to: toLocalDateInput(now) };
    case 'this-quarter': {
      const q = Math.floor(m / 3) * 3;
      return { from: d(y, q, 1), to: d(y, q + 3, 0) };
    }
    case 'this-fy': {
      const fy = fyStartYear(now);
      return { from: d(fy, 3, 1), to: d(fy + 1, 2, 31) };
    }
    case 'last-fy': {
      const fy = fyStartYear(now) - 1;
      return { from: d(fy, 3, 1), to: d(fy + 1, 2, 31) };
    }
    default:
      return { from: '', to: '' };
  }
}

/** Short label for a resolved range, e.g. "1 Apr 2026 – 31 Mar 2027". */
export function describeRange(from?: string, to?: string): string {
  const fmt = (s: string) =>
    new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${s}T00:00:00`));
  if (from && to) return `${fmt(from)} – ${fmt(to)}`;
  if (from) return `From ${fmt(from)}`;
  if (to) return `Until ${fmt(to)}`;
  return 'All time';
}

/** Inclusive client-side check for an ISO date string against a yyyy-mm-dd range. */
export function inRange(iso: string | undefined, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  if (!iso) return false;
  const day = toLocalDateInput(iso);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}
