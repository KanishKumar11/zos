// Client read-outs derived from invoices (OWNER only — the invoices endpoint is owner-only).
import { InvoiceStatus } from '@agency/shared';

import { todayLocal } from '@/lib/form';

import type { InvoiceRow } from '@/features/invoices/invoices.hooks';

const DAY = 86_400_000;
const dayOf = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00`);

/** What is still owed on an invoice (0 for drafts and write-offs). */
export function openBalance(inv: InvoiceRow): number {
  if (inv.status === InvoiceStatus.DRAFT || inv.status === InvoiceStatus.WRITTEN_OFF) return 0;
  return Math.max(0, inv.balancePaise ?? inv.totalPaise - inv.paidPaise);
}

export interface AgingBuckets {
  notDue: number;
  d1to30: number;
  d31to60: number;
  d60plus: number;
}

export const AGING_COLORS = {
  notDue: 'hsl(var(--success))',
  d1to30: 'hsl(var(--warning))',
  d31to60: 'hsl(var(--destructive) / 0.7)',
  d60plus: 'hsl(var(--destructive))',
} as const;

export const AGING_LABELS: Record<keyof AgingBuckets, string> = {
  notDue: 'Not due yet',
  d1to30: '1–30 days late',
  d31to60: '31–60 days late',
  d60plus: 'Over 60 days late',
};

export function agingOf(invoices: InvoiceRow[]): AgingBuckets {
  const today = dayOf(todayLocal());
  const out: AgingBuckets = { notDue: 0, d1to30: 0, d31to60: 0, d60plus: 0 };
  for (const inv of invoices) {
    const bal = openBalance(inv);
    if (!bal) continue;
    const late = inv.dueDate ? Math.round((today - dayOf(inv.dueDate)) / DAY) : 0;
    if (late <= 0) out.notDue += bal;
    else if (late <= 30) out.d1to30 += bal;
    else if (late <= 60) out.d31to60 += bal;
    else out.d60plus += bal;
  }
  return out;
}

/**
 * Cumulative amount billed to a client at the end of each of the last `months` months (pre-GST
 * subtotal, drafts excluded). Returns null when there isn't enough history for a meaningful line
 * (fewer than two months with invoices).
 */
export function lifetimeSeries(invoices: InvoiceRow[], months = 12): number[] | null {
  const billed = invoices.filter((i) => i.status !== InvoiceStatus.DRAFT && (i.issueDate || i.createdAt));
  const monthsWithInvoices = new Set(billed.map((i) => (i.issueDate ?? i.createdAt)!.slice(0, 7)));
  if (monthsWithInvoices.size < 2) return null;
  const now = new Date();
  const keys = Array.from({ length: months }, (_, k) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - k), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  return keys.map((key) => billed.filter((i) => (i.issueDate ?? i.createdAt)!.slice(0, 7) <= key).reduce((s, i) => s + i.subTotalPaise, 0));
}

/** Invoices grouped by client id. */
export function byClient(invoices: InvoiceRow[] | undefined): Map<string, InvoiceRow[]> {
  const m = new Map<string, InvoiceRow[]>();
  for (const i of invoices ?? []) m.set(i.clientId, [...(m.get(i.clientId) ?? []), i]);
  return m;
}
