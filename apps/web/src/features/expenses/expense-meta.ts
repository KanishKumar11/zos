// Expense categories, labels and the recurring-date helper shared by the expenses screens.
import type { ExpenseRecurring } from './expenses.hooks';

/** Categories offered when creating or editing an expense. */
export const EXPENSE_CATEGORIES = ['TOOLS', 'SOFTWARE', 'INFRASTRUCTURE', 'MARKETING', 'OPERATIONS', 'OTHER'] as const;

/**
 * Old categories kept so earlier rows still display and filter. They're hidden from the picker
 * because team and freelancer pay are already counted through payroll runs and Payments out.
 */
export const LEGACY_EXPENSE_CATEGORIES = ['PAYROLL', 'FREELANCER'] as const;

export const EXPENSE_CATEGORY_LABEL: Record<string, string> = {
  TOOLS: 'Tools',
  SOFTWARE: 'Software',
  INFRASTRUCTURE: 'Infrastructure',
  MARKETING: 'Marketing',
  OPERATIONS: 'Operations',
  PAYROLL: 'Payroll (old)',
  FREELANCER: 'Freelancer (old)',
  OTHER: 'Other',
};

export const categoryLabel = (c: string): string => EXPENSE_CATEGORY_LABEL[c] ?? c;

export const RECURRING_LABEL: Record<ExpenseRecurring, string> = {
  NONE: "Doesn't repeat",
  MONTHLY: 'Monthly',
  YEARLY: 'Yearly',
};

export const isRecurring = (r: ExpenseRecurring | undefined): r is 'MONTHLY' | 'YEARLY' => r === 'MONTHLY' || r === 'YEARLY';

const pad = (n: number) => String(n).padStart(2, '0');
const daysIn = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

/**
 * Next period's date (yyyy-mm-dd) for a recurring expense. Keeps the day, clamped to the end of a
 * shorter month (31 Jan → 28 Feb). Mirrors the API's nextPeriodYmd so the confirm shows the real date.
 */
export function nextPeriodYmd(ymd: string, recurring: 'MONTHLY' | 'YEARLY'): string {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number) as [number, number, number];
  const m0 = m - 1;
  if (recurring === 'YEARLY') return `${y + 1}-${pad(m)}-${pad(Math.min(d, daysIn(y + 1, m0)))}`;
  const ny = m0 === 11 ? y + 1 : y;
  const nm0 = (m0 + 1) % 12;
  return `${ny}-${pad(nm0 + 1)}-${pad(Math.min(d, daysIn(ny, nm0)))}`;
}

/** The stored day of an expense (dates are saved at 12:00 UTC, so the UTC day is the calendar day). */
export const storedYmd = (iso: string): string => iso.slice(0, 10);

/** How a category reads mid-sentence: "₹12k of it on software". */
const EXPENSE_CATEGORY_PHRASE: Record<string, string> = {
  TOOLS: 'tools',
  SOFTWARE: 'software',
  INFRASTRUCTURE: 'infrastructure',
  MARKETING: 'marketing',
  OPERATIONS: 'operations',
  PAYROLL: 'old payroll entries',
  FREELANCER: 'old freelancer entries',
  OTHER: 'other costs',
};

export const categoryPhrase = (c: string): string => EXPENSE_CATEGORY_PHRASE[c] ?? categoryLabel(c).toLowerCase();
