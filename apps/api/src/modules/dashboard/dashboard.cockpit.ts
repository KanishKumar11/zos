// Pure helpers for the owner command centre (GET /dashboard/owner/cockpit). Kept free of Nest/Mongoose
// so they can be unit-tested. Overdue logic comes from invoice.rules so the dashboard never disagrees
// with the invoices module.
import type { InvoiceStatus } from '@agency/shared';

import { balanceOf, daysPastDue, isOverdue } from '../invoices/invoice.rules';

export type AgingKey = 'current' | '1-30' | '31-60' | '60plus';

export interface AgingBucket {
  key: AgingKey;
  label: string;
  paise: number;
  count: number;
}

export interface AgingSummary {
  buckets: AgingBucket[];
  outstandingPaise: number;
  overduePaise: number;
  openCount: number;
  overdueCount: number;
  /** Distinct clients with at least one overdue invoice. */
  overdueClients: number;
  /** Distinct clients with any balance. */
  owingClients: number;
}

export interface AgingInvoice {
  status: InvoiceStatus;
  totalPaise: number;
  paidPaise: number;
  dueDate?: Date | null;
  clientId?: unknown;
}

const AGING_LABELS: Record<AgingKey, string> = {
  current: 'Not due yet',
  '1-30': '1–30 days late',
  '31-60': '31–60 days late',
  '60plus': '60+ days late',
};

/** Which aging bucket an open invoice falls in (null when nothing is owed). */
export function agingKeyOf(inv: AgingInvoice, now: Date = new Date()): AgingKey | null {
  if (balanceOf(inv) <= 0) return null;
  if (!isOverdue(inv, now)) return 'current';
  const days = daysPastDue(inv.dueDate, now);
  if (days <= 30) return '1-30';
  if (days <= 60) return '31-60';
  return '60plus';
}

/** Receivables split into current / 1–30 / 31–60 / 60+ days late. */
export function agingSummary(invoices: AgingInvoice[], now: Date = new Date()): AgingSummary {
  const buckets = (Object.keys(AGING_LABELS) as AgingKey[]).map((key) => ({ key, label: AGING_LABELS[key], paise: 0, count: 0 }));
  const overdueClients = new Set<string>();
  const owingClients = new Set<string>();
  let outstandingPaise = 0;
  let overduePaise = 0;
  let openCount = 0;
  let overdueCount = 0;
  for (const inv of invoices) {
    const key = agingKeyOf(inv, now);
    if (!key) continue;
    const balance = balanceOf(inv);
    const bucket = buckets.find((b) => b.key === key)!;
    bucket.paise += balance;
    bucket.count++;
    outstandingPaise += balance;
    openCount++;
    const client = inv.clientId ? String(inv.clientId) : '';
    if (client) owingClients.add(client);
    if (key !== 'current') {
      overduePaise += balance;
      overdueCount++;
      if (client) overdueClients.add(client);
    }
  }
  return {
    buckets,
    outstandingPaise,
    overduePaise,
    openCount,
    overdueCount,
    overdueClients: overdueClients.size,
    owingClients: owingClients.size,
  };
}

interface ShareInvoice {
  projectId?: unknown;
  subTotalPaise?: number;
  lineItems?: { qty: number; unitPaise: number; projectId?: unknown }[];
}

/**
 * Fraction of an invoice that belongs to `projectId` — same rule as ProjectsService.projectBalance:
 * single-project invoices count fully; on a multi-project invoice each project takes the share its own
 * line items represent, so a shared payment is never counted twice.
 */
export function projectShare(inv: ShareInvoice, projectId: string): number {
  const lineTotal = (li: { qty: number; unitPaise: number }) => Math.round(li.qty * li.unitPaise);
  const items = inv.lineItems ?? [];
  const tagged = items.filter((li) => li.projectId);
  if (tagged.length === 0) return inv.projectId && String(inv.projectId) === projectId ? 1 : 0;
  const mine = tagged.filter((li) => String(li.projectId) === projectId).reduce((s, li) => s + lineTotal(li), 0);
  const subTotal = inv.subTotalPaise || items.reduce((s, li) => s + lineTotal(li), 0);
  return subTotal > 0 ? mine / subTotal : 0;
}

export interface FlowSource {
  key: string;
  label: string;
  paise: number;
}

/**
 * Inflow nodes for the sankey: the biggest clients by name, the rest folded into "Other clients",
 * plus other income. When more went out than came in, a "From reserves" node balances the picture.
 */
export function buildInflows(
  byClient: FlowSource[],
  otherIncomePaise: number,
  outPaise: number,
  maxClients = 5,
): FlowSource[] {
  const sorted = byClient.filter((c) => c.paise > 0).sort((a, b) => b.paise - a.paise);
  const top = sorted.slice(0, maxClients);
  const rest = sorted.slice(maxClients).reduce((s, c) => s + c.paise, 0);
  const nodes: FlowSource[] = [...top];
  if (rest > 0) nodes.push({ key: 'other-clients', label: `${sorted.length - maxClients} more clients`, paise: rest });
  if (otherIncomePaise > 0) nodes.push({ key: 'other-income', label: 'Other income', paise: otherIncomePaise });
  const inPaise = nodes.reduce((s, n) => s + n.paise, 0);
  if (outPaise > inPaise) nodes.push({ key: 'reserves', label: 'From reserves', paise: outPaise - inPaise });
  return nodes;
}
