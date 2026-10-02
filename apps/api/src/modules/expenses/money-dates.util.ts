// Small helpers shared by the expenses and other-income services.

/** Dates arrive as yyyy-mm-dd; store at 12:00 UTC so the calendar day is the same in every timezone. */
export const dayToDate = (ymd: string): Date => new Date(`${ymd.slice(0, 10)}T12:00:00.000Z`);
export const dayStart = (ymd: string): Date => new Date(`${ymd.slice(0, 10)}T00:00:00.000Z`);
export const dayEnd = (ymd: string): Date => new Date(`${ymd.slice(0, 10)}T23:59:59.999Z`);

export const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const inr = (paise: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(paise / 100);

const pad = (n: number) => String(n).padStart(2, '0');
const toYmd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/**
 * Next period's date for a recurring cost, as yyyy-mm-dd. The day is kept, clamped to the end of a
 * shorter month (31 Jan → 28/29 Feb, 29 Feb → 28 Feb next year). Mirrors the web helper.
 */
export function nextPeriodYmd(ymd: string, recurring: 'MONTHLY' | 'YEARLY'): string {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number) as [number, number, number];
  const month0 = m - 1;
  if (recurring === 'YEARLY') return toYmd(y + 1, month0, Math.min(d, daysIn(y + 1, month0)));
  const ny = month0 === 11 ? y + 1 : y;
  const nm = (month0 + 1) % 12;
  return toYmd(ny, nm, Math.min(d, daysIn(ny, nm)));
}

/** yyyy-mm-dd of a stored date (UTC calendar day — matches dayToDate()). */
export const dateToYmd = (d: Date): string => d.toISOString().slice(0, 10);
