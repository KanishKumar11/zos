// Pure invoice rules — numbering, calendar-day due dates (Asia/Kolkata) and status derivation.
// Kept free of Nest/Mongoose so they can be unit-tested and reused by other modules.
import { InvoiceStatus } from '@agency/shared';
import type { Model } from 'mongoose';

/** Business timezone for due dates, financial years and "today". */
export const INVOICE_TZ = 'Asia/Kolkata';
const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

/** Calendar day (yyyy-mm-dd) of an instant in India. */
export const istDay = (d: Date | string | number): string =>
  new Date(new Date(d).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

/** The instant today's India calendar day began (00:00 IST). */
export const istTodayStart = (now: Date = new Date()): Date =>
  new Date(Date.parse(`${istDay(now)}T00:00:00.000Z`) - IST_OFFSET_MS);

/** True when the due date's India calendar day is before today's — due *on* today is not overdue. */
export const isPastDue = (dueDate: Date | string | undefined | null, now: Date = new Date()): boolean =>
  !!dueDate && istDay(dueDate) < istDay(now);

/** Whole days a due date is past (0 when not overdue). */
export const daysPastDue = (dueDate: Date | string | undefined | null, now: Date = new Date()): number => {
  if (!dueDate || !isPastDue(dueDate, now)) return 0;
  return Math.round((Date.parse(`${istDay(now)}T00:00:00Z`) - Date.parse(`${istDay(dueDate)}T00:00:00Z`)) / DAY_MS);
};

/** Date stored for a yyyy-mm-dd day (UTC midnight — same day in India). */
export const dayToDate = (ymd: string): Date => new Date(`${ymd.slice(0, 10)}T00:00:00.000Z`);

/** issueDate + payment terms, as the stored date of that India calendar day. */
export const addTermsDays = (issueDate: Date, days: number): Date =>
  new Date(dayToDate(istDay(issueDate)).getTime() + Math.max(0, days) * DAY_MS);

/** Indian financial year label for a date, e.g. 2 Oct 2026 → "2026-27", 15 Feb 2027 → "2026-27". */
export function financialYearLabel(date: Date): string {
  const [y, m] = istDay(date).split('-').map(Number) as [number, number];
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** Start/end (exclusive) instants of the Indian financial year containing `date`. */
export function financialYearRange(date: Date = new Date()): { start: Date; end: Date; label: string } {
  const label = financialYearLabel(date);
  const startYear = Number(label.slice(0, 4));
  return {
    start: new Date(Date.parse(`${startYear}-04-01T00:00:00.000Z`) - IST_OFFSET_MS),
    end: new Date(Date.parse(`${startYear + 1}-04-01T00:00:00.000Z`) - IST_OFFSET_MS),
    label,
  };
}

export const INVOICE_PREFIX = 'ZLK';
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Next invoice number for the financial year of `issueDate`: `ZLK-2026-27-0001`.
 * Soft-deleted invoices are included, so a number is never handed out twice (the
 * `number` index is unique across deleted rows too).
 */
export async function nextInvoiceNumber(
  model: Model<{ number: string }> | Model<any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  issueDate: Date = new Date(),
): Promise<string> {
  const prefix = `${INVOICE_PREFIX}-${financialYearLabel(issueDate)}-`;
  const rows = (await (model as Model<{ number: string }>)
    .find({ number: { $regex: `^${escapeRe(prefix)}\\d+$` } })
    .select('number')
    .lean()
    .exec()) as { number: string }[];
  const max = rows.reduce((m, r) => Math.max(m, parseInt(r.number.slice(prefix.length), 10) || 0), 0);
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

/** Mongo duplicate-key error (E11000), optionally on a given field. */
export const isDuplicateKeyError = (err: unknown, field?: string): boolean => {
  const e = err as { code?: number; keyPattern?: Record<string, unknown>; message?: string } | undefined;
  if (e?.code !== 11000) return false;
  if (!field) return true;
  return !!e.keyPattern?.[field] || !!e.message?.includes(field);
};

/** PARTIALLY_PAID is a legacy duplicate of PARTIAL. */
export const normalizeStatus = (s: InvoiceStatus): InvoiceStatus =>
  s === InvoiceStatus.PARTIALLY_PAID ? InvoiceStatus.PARTIAL : s;

/** Terminal statuses are set by hand and never recomputed from payments. */
export const isTerminalStatus = (s: InvoiceStatus): boolean => s === InvoiceStatus.WRITTEN_OFF;

/**
 * The status an invoice should have given its payments and due date.
 *  • DRAFT stays DRAFT until it is sent.  • WRITTEN_OFF is terminal.
 *  • paid ≥ total → PAID, paid > 0 → PARTIAL (even when late — see `isOverdue`),
 *    nothing paid → OVERDUE once the due day has passed, otherwise SENT.
 */
export function deriveStatus(
  inv: { status: InvoiceStatus; totalPaise: number; paidPaise: number; dueDate?: Date | null },
  now: Date = new Date(),
): InvoiceStatus {
  if (inv.status === InvoiceStatus.DRAFT || isTerminalStatus(inv.status)) return inv.status;
  if (inv.totalPaise > 0 && inv.paidPaise >= inv.totalPaise) return InvoiceStatus.PAID;
  if (inv.paidPaise > 0) return InvoiceStatus.PARTIAL;
  return isPastDue(inv.dueDate, now) ? InvoiceStatus.OVERDUE : InvoiceStatus.SENT;
}

/** Money still expected on an invoice (0 once written off). */
export const balanceOf = (inv: { status: InvoiceStatus; totalPaise: number; paidPaise: number }): number =>
  inv.status === InvoiceStatus.WRITTEN_OFF ? 0 : Math.max(0, inv.totalPaise - inv.paidPaise);

/** Issued, has a balance, and the due day has passed — true for late part-paid invoices too. */
export function isOverdue(
  inv: { status: InvoiceStatus; totalPaise: number; paidPaise: number; dueDate?: Date | null },
  now: Date = new Date(),
): boolean {
  const s = normalizeStatus(inv.status);
  if (s !== InvoiceStatus.SENT && s !== InvoiceStatus.PARTIAL && s !== InvoiceStatus.OVERDUE) return false;
  return balanceOf(inv) > 0 && isPastDue(inv.dueDate, now);
}
