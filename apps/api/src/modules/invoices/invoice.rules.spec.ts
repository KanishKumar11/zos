import { InvoiceStatus } from '@agency/shared';

import {
  addTermsDays,
  balanceOf,
  daysPastDue,
  deriveStatus,
  financialYearLabel,
  isOverdue,
  isPastDue,
  istDay,
  istTodayStart,
  nextInvoiceNumber,
} from './invoice.rules';

const at = (iso: string) => new Date(iso);

describe('invoice rules', () => {
  describe('financial year', () => {
    it('runs April to March in India', () => {
      expect(financialYearLabel(at('2026-10-02T10:00:00Z'))).toBe('2026-27');
      expect(financialYearLabel(at('2027-02-15T10:00:00Z'))).toBe('2026-27');
      expect(financialYearLabel(at('2027-04-01T00:00:00Z'))).toBe('2027-28');
      // 31 Mar 20:00 UTC is already 1 Apr in India.
      expect(financialYearLabel(at('2027-03-31T20:00:00Z'))).toBe('2027-28');
      expect(financialYearLabel(at('2099-06-01T00:00:00Z'))).toBe('2099-00');
    });
  });

  describe('calendar days in Asia/Kolkata', () => {
    it('maps instants to the India day', () => {
      expect(istDay(at('2026-10-01T18:29:00Z'))).toBe('2026-10-01');
      expect(istDay(at('2026-10-01T18:30:00Z'))).toBe('2026-10-02');
      expect(istTodayStart(at('2026-10-02T03:00:00Z')).toISOString()).toBe('2026-10-01T18:30:00.000Z');
    });

    it('is not overdue on the due day itself, only after', () => {
      const due = at('2026-10-02T00:00:00Z');
      expect(isPastDue(due, at('2026-10-02T00:10:00Z'))).toBe(false); // 05:40 IST on the due day
      expect(isPastDue(due, at('2026-10-02T18:00:00Z'))).toBe(false); // 23:30 IST
      expect(isPastDue(due, at('2026-10-02T18:31:00Z'))).toBe(true); // 00:01 IST next day
      expect(daysPastDue(due, at('2026-10-05T06:00:00Z'))).toBe(3);
    });

    it('adds payment terms by calendar day', () => {
      expect(istDay(addTermsDays(at('2026-10-02T00:00:00Z'), 15))).toBe('2026-10-17');
      expect(istDay(addTermsDays(at('2026-10-02T00:00:00Z'), 0))).toBe('2026-10-02');
    });
  });

  describe('status derivation', () => {
    const now = at('2026-10-10T06:00:00Z');
    const past = at('2026-10-01T00:00:00Z');
    const future = at('2026-10-20T00:00:00Z');
    const inv = (status: InvoiceStatus, paidPaise: number, dueDate = past) => ({ status, totalPaise: 1000, paidPaise, dueDate });

    it('keeps drafts as drafts', () => {
      expect(deriveStatus(inv(InvoiceStatus.DRAFT, 0), now)).toBe(InvoiceStatus.DRAFT);
    });
    it('never recomputes a write-off', () => {
      expect(deriveStatus(inv(InvoiceStatus.WRITTEN_OFF, 0), now)).toBe(InvoiceStatus.WRITTEN_OFF);
      expect(deriveStatus(inv(InvoiceStatus.WRITTEN_OFF, 1000), now)).toBe(InvoiceStatus.WRITTEN_OFF);
    });
    it('follows payments for issued invoices', () => {
      expect(deriveStatus(inv(InvoiceStatus.SENT, 1000), now)).toBe(InvoiceStatus.PAID);
      expect(deriveStatus(inv(InvoiceStatus.OVERDUE, 400), now)).toBe(InvoiceStatus.PARTIAL);
      expect(deriveStatus(inv(InvoiceStatus.PARTIALLY_PAID, 400), now)).toBe(InvoiceStatus.PARTIAL);
      expect(deriveStatus(inv(InvoiceStatus.PAID, 0), now)).toBe(InvoiceStatus.OVERDUE);
      expect(deriveStatus(inv(InvoiceStatus.PARTIAL, 0, future), now)).toBe(InvoiceStatus.SENT);
    });
    it('flags late part-paid invoices as overdue without changing their status', () => {
      const late = inv(InvoiceStatus.PARTIAL, 400);
      expect(deriveStatus(late, now)).toBe(InvoiceStatus.PARTIAL);
      expect(isOverdue(late, now)).toBe(true);
      expect(isOverdue(inv(InvoiceStatus.PARTIAL, 400, future), now)).toBe(false);
      expect(isOverdue(inv(InvoiceStatus.DRAFT, 0), now)).toBe(false);
      expect(isOverdue(inv(InvoiceStatus.WRITTEN_OFF, 0), now)).toBe(false);
    });
    it('has no balance once written off', () => {
      expect(balanceOf(inv(InvoiceStatus.WRITTEN_OFF, 100))).toBe(0);
      expect(balanceOf(inv(InvoiceStatus.PARTIAL, 100))).toBe(900);
    });
  });

  describe('nextInvoiceNumber', () => {
    const modelWith = (numbers: string[]) => {
      const calls: unknown[] = [];
      const model = {
        find: (q: unknown) => {
          calls.push(q);
          const chain = {
            select: () => chain,
            lean: () => chain,
            exec: async () => numbers.map((number) => ({ number })),
          };
          return chain;
        },
      };
      return { model, calls };
    };

    it('starts each financial year at 0001', async () => {
      const { model, calls } = modelWith([]);
      await expect(nextInvoiceNumber(model as never, at('2026-10-02T00:00:00Z'))).resolves.toBe('ZLK-2026-27-0001');
      // No deletedAt filter: soft-deleted numbers are never reused.
      expect(JSON.stringify(calls[0])).not.toContain('deletedAt');
    });

    it('continues from the highest number, not the count', async () => {
      const { model } = modelWith(['ZLK-2026-27-0002', 'ZLK-2026-27-0010', 'ZLK-2026-27-0007']);
      await expect(nextInvoiceNumber(model as never, at('2026-10-02T00:00:00Z'))).resolves.toBe('ZLK-2026-27-0011');
    });
  });
});
