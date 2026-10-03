import { AuditAction, Role } from '@agency/shared';

import { MONEY_ENTITIES, nonOwnerExclusion, presentAuditEntry, stripMoney } from './audit.presenter';

const entry = {
  action: AuditAction.PROJECT_UPDATED,
  entity: 'project',
  entityId: 'p1',
  before: {
    name: 'Website',
    clientBudgetPaise: 50_000_00,
    agencyMarginPaise: 20_000_00,
    members: [{ userId: 'u1', role: 'LEAD', amountPaise: 10_000_00 }],
    milestones: [{ name: 'Design', amountPaise: 25_000_00, status: 'PENDING' }],
  },
  after: { summary: '₹12,000 to Priya for Website', status: 'ACTIVE', totalPaise: 1200000 },
  ipAddress: '1.2.3.4',
};

describe('audit presenter', () => {
  it('shows the owner everything', () => {
    expect(presentAuditEntry(entry, Role.OWNER)).toEqual(entry);
  });

  it.each([Role.ADMIN, Role.LEAD, Role.MEMBER])('removes every amount for %s', (role) => {
    const out = presentAuditEntry(entry, role);
    const json = JSON.stringify(out);
    expect(json).not.toMatch(/Paise/);
    expect(json).not.toContain('5000000');
    expect(json).not.toContain('12,000');
    expect(json).not.toContain('1.2.3.4');
    // Non-money context survives.
    expect(json).toContain('Website');
    expect(json).toContain('LEAD');
    expect((out.after as Record<string, unknown>).summary).toBe('an amount to Priya for Website');
  });

  it('handles other currency formats in text', () => {
    expect(stripMoney('Paid Rs. 4,500 and $120.50 and €9')).toBe('Paid an amount and an amount and an amount');
  });

  it('excludes money entities and actions from non-owner queries', () => {
    const f = nonOwnerExclusion() as { $nor: Record<string, unknown>[] };
    const entityRe = f.$nor[0]!.entity as RegExp;
    for (const e of MONEY_ENTITIES) expect(entityRe.test(e)).toBe(true);
    expect(entityRe.test('Invoice')).toBe(true);
    expect(entityRe.test('project')).toBe(false);
    expect((f.$nor[1]!.action as { $in: string[] }).$in).toContain(AuditAction.MEMBER_FEE_SET);
  });
});
