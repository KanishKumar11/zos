// Plain words for invoice states, written for clients.
import type { PortalInvoice } from './portal.hooks';

export type WordTone = 'good' | 'bad' | 'muted' | 'default';

export function invoiceWord(i: Pick<PortalInvoice, 'status' | 'paidPaise' | 'balancePaise'>): { label: string; tone: WordTone } {
  switch (i.status) {
    case 'PAID':
      return { label: 'Paid', tone: 'good' };
    case 'OVERDUE':
      return { label: 'Past due date', tone: 'bad' };
    case 'PARTIAL':
    case 'PARTIALLY_PAID':
      return { label: 'Part paid', tone: 'default' };
    case 'WRITTEN_OFF':
      return { label: 'Closed', tone: 'muted' };
    case 'VOID':
      return { label: 'Cancelled', tone: 'muted' };
    default:
      return i.paidPaise > 0 && i.balancePaise > 0 ? { label: 'Part paid', tone: 'default' } : { label: 'Awaiting payment', tone: 'default' };
  }
}

/** Still something to pay on it. */
export const isOpen = (i: Pick<PortalInvoice, 'status' | 'balancePaise'>) => i.balancePaise > 0 && i.status !== 'WRITTEN_OFF' && i.status !== 'VOID';

/** Whole days from a to b (yyyy-mm-dd, local). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by!, bm! - 1, bd!) - Date.UTC(ay!, am! - 1, ad!)) / 86_400_000);
}
