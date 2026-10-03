// Small contract helpers shared by the list, detail and form.
import { ContractStatus, SUPPORTED_CURRENCIES } from '@agency/shared';

import { thisMonthLocal, todayLocal } from '@/lib/form';

import type { ContractRow } from './contracts.hooks';

export const CONTRACT_STATUS_OPTIONS = [
  { value: ContractStatus.ACTIVE, label: 'Active' },
  { value: ContractStatus.PAUSED, label: 'Paused' },
  { value: ContractStatus.COMPLETED, label: 'Ended' },
];

export const CONTRACT_STATUS_TONE = {
  [ContractStatus.ACTIVE]: 'success',
  [ContractStatus.PAUSED]: 'warning',
  [ContractStatus.COMPLETED]: 'outline',
} as const;

export const contractStatusLabel = (s: ContractStatus): string =>
  CONTRACT_STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;

export const CURRENCIES = SUPPORTED_CURRENCIES as readonly string[];

/** yyyy-mm of a stored date (stored as UTC midnight of the calendar day). */
export const monthOf = (iso: string): string => iso.slice(0, 7);

export const monthLabel = (month: string): string => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y!, m! - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
};

const DAY_MS = 86_400_000;

/** Days until the contract ends (negative once it has ended); undefined without an end date. */
export function daysToEnd(c: Pick<ContractRow, 'endDate'>): number | undefined {
  if (!c.endDate) return undefined;
  const end = new Date(`${c.endDate.slice(0, 10)}T00:00:00`);
  const today = new Date(`${todayLocal()}T00:00:00`);
  return Math.round((end.getTime() - today.getTime()) / DAY_MS);
}

/** Active contract ending within the next 30 days. */
export const endsSoon = (c: ContractRow): boolean => {
  const d = daysToEnd(c);
  return c.status === ContractStatus.ACTIVE && d !== undefined && d >= 0 && d <= 30;
};

/** Why a contract can't be billed for `month` (mirrors the server's rules), or undefined. */
export function billingProblem(c: ContractRow, month: string): string | undefined {
  if (c.status === ContractStatus.PAUSED) return 'This contract is paused. Set it back to active to bill it.';
  if (c.status === ContractStatus.COMPLETED) return 'This contract has ended. Set it back to active to bill it again.';
  if (c.startDate && month < monthOf(c.startDate)) return `It starts in ${monthLabel(monthOf(c.startDate))}.`;
  if (c.endDate && month > monthOf(c.endDate)) return `It ended in ${monthLabel(monthOf(c.endDate))}.`;
  return undefined;
}

/** Active, running this month, and no invoice for this month yet. */
export const dueThisMonth = (c: ContractRow, month = thisMonthLocal()): boolean =>
  !billingProblem(c, month) && !(c.billing?.billedMonths ?? []).includes(month);

const pad = (n: number) => String(n).padStart(2, '0');
const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();

/** Whole days from today (local) to a yyyy-mm-dd date; negative when it's past. */
export function daysUntil(date: string): number {
  const target = new Date(`${date.slice(0, 10)}T00:00:00`);
  const today = new Date(`${todayLocal()}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / DAY_MS);
}

/**
 * Next billing reminder date (yyyy-mm-dd, local) for an active contract with a billing day — today
 * counts. Short months clamp the day (31 → 30 Sep). Undefined when there's no reminder to show.
 */
export function nextBillingDate(c: Pick<ContractRow, 'status' | 'billingDay' | 'startDate' | 'endDate'>): string | undefined {
  if (c.status !== ContractStatus.ACTIVE || !c.billingDay) return undefined;
  const [ty, tm, td] = todayLocal().split('-').map(Number) as [number, number, number];
  let y = ty;
  let m = tm;
  if (c.startDate && c.startDate.slice(0, 7) > `${ty}-${pad(tm)}`) {
    [y, m] = c.startDate.slice(0, 7).split('-').map(Number) as [number, number];
  } else if (Math.min(c.billingDay, daysInMonth(y, m)) < td) {
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  const date = `${y}-${pad(m)}-${pad(Math.min(c.billingDay, daysInMonth(y, m)))}`;
  if (c.endDate && date.slice(0, 7) > c.endDate.slice(0, 7)) return undefined;
  return date;
}

/** First day (yyyy-mm-dd) of the Indian financial year (April–March) that contains today. */
export function financialYearStart(): string {
  const [y, m] = todayLocal().split('-').map(Number) as [number, number];
  return `${m >= 4 ? y : y - 1}-04-01`;
}

/** "FY 2026–27" label for the current financial year. */
export function financialYearLabel(): string {
  const start = Number(financialYearStart().slice(0, 4));
  return `FY ${start}–${String(start + 1).slice(2)}`;
}

/** Default GST for a contract's invoices: its own rate, else 18% in INR (0% for export billing). */
export const defaultGst = (c: Pick<ContractRow, 'gstPercent' | 'currency'>): number =>
  typeof c.gstPercent === 'number' ? c.gstPercent : c.currency === 'INR' ? 18 : 0;

/** Sum amounts per currency (never add rupees to dollars). */
export function totalsByCurrency<T>(rows: T[], amount: (r: T) => number, currency: (r: T) => string): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) out.set(currency(r) || 'INR', (out.get(currency(r) || 'INR') ?? 0) + amount(r));
  return out;
}

/** "₹1,20,000" or "₹1,20,000 + $2,000" — INR first. */
export function formatTotals(totals: Map<string, number>, formatter: (paise: number, currency: string) => string): string {
  if (totals.size === 0) return formatter(0, 'INR');
  return [...totals.entries()]
    .sort(([a], [b]) => (a === 'INR' ? -1 : b === 'INR' ? 1 : a.localeCompare(b)))
    .map(([cur, paise]) => formatter(paise, cur))
    .join(' + ');
}
