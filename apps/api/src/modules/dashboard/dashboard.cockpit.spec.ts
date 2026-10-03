import { InvoiceStatus } from '@agency/shared';

import { agingKeyOf, agingSummary, buildInflows, projectShare } from './dashboard.cockpit';

const now = new Date('2026-10-03T06:00:00Z'); // 3 Oct, 11:30 IST
const day = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
const inv = (dueDate: string | undefined, over: Partial<{ status: InvoiceStatus; totalPaise: number; paidPaise: number; clientId: string }> = {}) => ({
  status: InvoiceStatus.SENT,
  totalPaise: 10_000,
  paidPaise: 0,
  dueDate: dueDate ? day(dueDate) : undefined,
  ...over,
});

describe('command centre helpers', () => {
  it('buckets receivables by days past due (due today is not late)', () => {
    expect(agingKeyOf(inv('2026-10-03'), now)).toBe('current');
    expect(agingKeyOf(inv(undefined), now)).toBe('current');
    expect(agingKeyOf(inv('2026-10-02'), now)).toBe('1-30');
    expect(agingKeyOf(inv('2026-09-03'), now)).toBe('1-30');
    expect(agingKeyOf(inv('2026-09-02'), now)).toBe('31-60');
    expect(agingKeyOf(inv('2026-08-04'), now)).toBe('31-60');
    expect(agingKeyOf(inv('2026-08-03'), now)).toBe('60plus');
  });

  it('ignores paid and written-off invoices', () => {
    expect(agingKeyOf(inv('2026-01-01', { paidPaise: 10_000 }), now)).toBeNull();
    expect(agingKeyOf(inv('2026-01-01', { status: InvoiceStatus.WRITTEN_OFF }), now)).toBeNull();
  });

  it('sums balances and counts overdue clients once', () => {
    const s = agingSummary(
      [
        inv('2026-10-10', { clientId: 'a' }),
        inv('2026-09-20', { clientId: 'b', paidPaise: 4_000, status: InvoiceStatus.PARTIAL }),
        inv('2026-07-01', { clientId: 'b' }),
      ],
      now,
    );
    expect(s.outstandingPaise).toBe(26_000);
    expect(s.overduePaise).toBe(16_000);
    expect(s.overdueCount).toBe(2);
    expect(s.overdueClients).toBe(1);
    expect(s.owingClients).toBe(2);
    expect(s.buckets.map((b) => b.paise)).toEqual([10_000, 6_000, 0, 10_000]);
  });

  it('splits multi-project invoices by line share', () => {
    const shared = {
      subTotalPaise: 1_000,
      lineItems: [
        { qty: 1, unitPaise: 750, projectId: 'p1' },
        { qty: 1, unitPaise: 250, projectId: 'p2' },
      ],
    };
    expect(projectShare(shared, 'p1')).toBe(0.75);
    expect(projectShare(shared, 'p3')).toBe(0);
    expect(projectShare({ projectId: 'p1', lineItems: [{ qty: 1, unitPaise: 5 }] }, 'p1')).toBe(1);
  });

  it('folds small clients together and balances a loss from reserves', () => {
    const clients = Array.from({ length: 7 }, (_, i) => ({ key: `c${i}`, label: `Client ${i}`, paise: (i + 1) * 100 }));
    const nodes = buildInflows(clients, 50, 10_000);
    expect(nodes.slice(0, 5).map((n) => n.key)).toEqual(['c6', 'c5', 'c4', 'c3', 'c2']);
    expect(nodes.find((n) => n.key === 'other-clients')?.paise).toBe(300);
    expect(nodes.find((n) => n.key === 'other-income')?.paise).toBe(50);
    expect(nodes.find((n) => n.key === 'reserves')?.paise).toBe(10_000 - 2_800 - 50);
    expect(buildInflows([], 0, 0)).toEqual([]);
  });
});
