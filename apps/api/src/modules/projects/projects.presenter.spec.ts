import { Role } from '@agency/shared';

import { presentProject } from './projects.presenter';

const OWNER_ID = 'owner000000000000000000a';
const ALICE = 'alice000000000000000000a';
const BOB = 'bob00000000000000000000a';

const project = {
  _id: 'proj0000000000000000000a',
  name: 'Website revamp',
  code: 'WEB',
  status: 'ACTIVE',
  brief: 'Rebuild the marketing site',
  clientId: 'client00000000000000000a',
  clientBudgetPaise: 50_000_00,
  agencyMarginPaise: 20_000_00,
  currency: 'INR',
  members: [
    {
      userId: ALICE,
      role: 'LEAD',
      addedAt: '2026-09-01',
      amountPaise: 20_000_00,
      payments: [
        { _id: 'p1', paidAt: '2026-09-10', amountPaise: 5_000_00, note: 'Advance' },
        { _id: 'p2', paidAt: '2026-09-20', amountPaise: 3_000_00, note: '' },
      ],
    },
    {
      userId: BOB,
      role: 'CONTRIBUTOR',
      addedAt: '2026-09-01',
      amountPaise: 10_000_00,
      payments: [{ _id: 'p3', paidAt: '2026-09-15', amountPaise: 10_000_00, note: '' }],
    },
  ],
  milestones: [
    { _id: 'm1', name: 'Design', amountPaise: 25_000_00, status: 'INVOICED', invoiceId: 'inv1', dueDate: '2026-10-01' },
  ],
};

const MONEY_KEYS = ['clientId', 'clientBudgetPaise', 'agencyMarginPaise', 'currency'];

describe('presentProject', () => {
  it('gives the owner the full project', () => {
    expect(presentProject(project, { sub: OWNER_ID, role: Role.OWNER })).toEqual(project);
  });

  it.each([Role.ADMIN, Role.LEAD, Role.MEMBER, Role.INTERN])(
    'hides project money from %s',
    (role) => {
      const out = presentProject(project, { sub: ALICE, role });
      for (const key of MONEY_KEYS) expect(out).not.toHaveProperty(key);
      expect(out.milestones[0]).not.toHaveProperty('amountPaise');
      expect(out.milestones[0]).not.toHaveProperty('invoiceId');
      for (const m of out.members) {
        expect(m).not.toHaveProperty('amountPaise');
        expect(m).not.toHaveProperty('payments');
      }
    },
  );

  const alicePaid = {
    paidPaise: 8_000_00,
    payments: [
      { _id: 'p1', paidAt: '2026-09-10', amountPaise: 5_000_00, note: 'Advance' },
      { _id: 'p2', paidAt: '2026-09-20', amountPaise: 3_000_00, note: '' },
    ],
  };

  it("shows a member only their own agreed fee and payments", () => {
    const out = presentProject(project, { sub: ALICE, role: Role.MEMBER }, alicePaid);
    expect(out.myEngagement).toEqual({
      agreedPaise: 20_000_00,
      paidPaise: 8_000_00,
      pendingPaise: 12_000_00,
      currency: 'INR',
      payments: [
        { _id: 'p1', paidAt: '2026-09-10', amountPaise: 5_000_00, note: 'Advance' },
        { _id: 'p2', paidAt: '2026-09-20', amountPaise: 3_000_00, note: '' },
      ],
    });
    // Bob's ₹10,000 must not appear anywhere in Alice's response.
    expect(JSON.stringify(out)).not.toContain('1000000');
  });

  it('gives non-members (e.g. admin) no engagement', () => {
    const out = presentProject(project, { sub: 'admin00000000000000000a', role: Role.ADMIN });
    expect(out.myEngagement).toBeNull();
  });

  it('never reports negative pending when overpaid', () => {
    const out = presentProject(project, { sub: BOB, role: Role.MEMBER }, { paidPaise: 12_000_00, payments: [] });
    expect(out.myEngagement.pendingPaise).toBe(0);
  });
});
