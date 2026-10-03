// Invoice aging — how late the money clients still owe is. One place for the bucket keys, labels and
// colours so the invoices list, the owner dashboard and anything else that links to
// `/invoices?status=open&aging=<key>` agree exactly.
//
// Lateness comes from the API presenter (`isOverdue`, `daysOverdue`, `balancePaise`), which already
// applies the server's invoice rules (India calendar day, part-paid invoices included).
import { InvoiceStatus, OPEN_INVOICE_STATUSES } from '@agency/shared';

export type AgingKey = 'current' | '1-30' | '31-60' | '60plus';

export const AGING_KEYS: readonly AgingKey[] = ['current', '1-30', '31-60', '60plus'];

/** Full label, e.g. for a filter chip: "31–60 days late". */
export const AGING_LABEL: Record<AgingKey, string> = {
  current: 'Not due yet',
  '1-30': '1–30 days late',
  '31-60': '31–60 days late',
  '60plus': 'Over 60 days late',
};

/** Short label for legends under a bar. */
export const AGING_SHORT_LABEL: Record<AgingKey, string> = {
  current: 'Not due',
  '1-30': '1–30 days late',
  '31-60': '31–60',
  '60plus': '60+',
};

export const AGING_COLOR: Record<AgingKey, string> = {
  current: 'hsl(var(--success))',
  '1-30': 'hsl(var(--warning))',
  '31-60': 'hsl(var(--destructive) / 0.7)',
  '60plus': 'hsl(var(--destructive))',
};

export function isAgingKey(value: unknown): value is AgingKey {
  return typeof value === 'string' && (AGING_KEYS as readonly string[]).includes(value);
}

/** The fields aging needs — `InvoiceRow` satisfies it. */
export interface AgingInput {
  status: InvoiceStatus | string;
  totalPaise: number;
  paidPaise: number;
  balancePaise?: number;
  isOverdue?: boolean;
  daysOverdue?: number;
}

const OPEN = new Set<string>(OPEN_INVOICE_STATUSES);

/** What is still owed on an invoice (0 once written off). */
export function balanceOf(row: AgingInput): number {
  if (row.status === InvoiceStatus.WRITTEN_OFF) return 0;
  return row.balancePaise ?? Math.max(0, row.totalPaise - row.paidPaise);
}

/** Which bucket an invoice falls in, or null when nothing is owed on it (draft, paid, written off). */
export function agingBucketOf(row: AgingInput): AgingKey | null {
  if (!OPEN.has(row.status)) return null;
  if (balanceOf(row) <= 0) return null;
  if (!row.isOverdue) return 'current';
  const days = row.daysOverdue ?? 0;
  if (days <= 30) return '1-30';
  if (days <= 60) return '31-60';
  return '60plus';
}

export interface AgingBucket {
  key: AgingKey;
  label: string;
  shortLabel: string;
  color: string;
  /** Balance owed in this bucket. */
  paise: number;
  count: number;
}

/** Always returns the four buckets in order (empty ones with 0), from any list of invoices. */
export function agingBuckets(rows: readonly AgingInput[] | undefined): AgingBucket[] {
  const out = new Map<AgingKey, AgingBucket>(
    AGING_KEYS.map((key) => [
      key,
      { key, label: AGING_LABEL[key], shortLabel: AGING_SHORT_LABEL[key], color: AGING_COLOR[key], paise: 0, count: 0 },
    ]),
  );
  for (const row of rows ?? []) {
    const key = agingBucketOf(row);
    if (!key) continue;
    const b = out.get(key)!;
    b.paise += balanceOf(row);
    b.count += 1;
  }
  return AGING_KEYS.map((k) => out.get(k)!);
}

/** Link to the invoices list filtered to one bucket — the URL contract other pages use. */
export const agingHref = (key: AgingKey): string => `/invoices?status=open&aging=${key}`;
