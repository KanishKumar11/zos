// PayrollService against tiny in-memory fakes: manual adjustments must survive a recompute and
// payslip ids must stay the same.
import { Types } from 'mongoose';

import { CompensationType, PayrollSkipReason, PayrollStatus, Role, UserStatus } from '@agency/shared';

import { PayrollService } from './payroll.service';

type Doc = Record<string, any>;

const matches = (doc: Doc, filter: Doc): boolean =>
  Object.entries(filter).every(([k, v]) => {
    if (v && typeof v === 'object' && '$nin' in v) return !(v.$nin as unknown[]).some((x) => String(x) === String(doc[k]));
    if (v && typeof v === 'object' && '$in' in v) return (v.$in as unknown[]).some((x) => String(x) === String(doc[k]));
    return String(doc[k]) === String(v);
  });

const q = <T>(value: T) => ({ exec: async () => value });

function makeDoc(store: Doc[], data: Doc): Doc {
  const _id = data._id ?? new Types.ObjectId();
  const doc: Doc = {
    adjustments: [],
    ...data,
    _id,
    get id() {
      return String(_id);
    },
    save: async () => doc,
    markModified: () => undefined,
    toJSON: () => ({ ...doc }),
  };
  store.push(doc);
  return doc;
}

function fakeSlips(store: Doc[]) {
  return {
    find: (f: Doc) => q(store.filter((d) => matches(d, f))),
    findOne: (f: Doc) => q(store.find((d) => matches(d, f)) ?? null),
    findById: (id: string) => q(store.find((d) => String(d._id) === String(id)) ?? null),
    countDocuments: (f: Doc) => q(store.filter((d) => matches(d, f)).length),
    deleteMany: (f: Doc) => ({
      exec: async () => {
        for (let i = store.length - 1; i >= 0; i--) if (matches(store[i]!, f)) store.splice(i, 1);
      },
    }),
    findOneAndUpdate: (f: Doc, update: { $set: Doc }) => ({
      exec: async () => {
        const existing = store.find((d) => matches(d, f));
        if (existing) {
          Object.assign(existing, update.$set);
          return existing;
        }
        return makeDoc(store, { ...update.$set });
      },
    }),
  };
}

describe('PayrollService adjustments', () => {
  const userId = new Types.ObjectId();
  const runId = new Types.ObjectId();
  let slipStore: Doc[];
  let run: Doc;
  let svc: PayrollService;
  let comp: { effectiveFor: jest.Mock };

  beforeEach(() => {
    slipStore = [];
    run = makeDoc([], { _id: runId, month: '2026-09', status: PayrollStatus.DRAFT, skipped: [] });
    const runs = { findById: () => q(run), findOne: () => q(null) };
    const users = {
      list: async () => [
        { _id: userId, id: String(userId), name: 'Priya', role: Role.MEMBER, status: UserStatus.PROBATION },
      ],
    };
    comp = {
      effectiveFor: jest.fn(async () => ({
        type: CompensationType.FIXED_MONTHLY,
        baseAmount: 30_000_00,
        currency: 'INR',
        hra: 0,
        specialAllowance: 0,
        providentFundEmployee: 0,
        providentFundEmployer: 0,
        professionalTax: 0,
        tdsMonthly: 0,
        effectiveFrom: new Date('2026-01-01'),
      })),
    };
    const attendance = { entriesFor: async () => [] };
    const holidays = { holidayDateSet: async () => new Set<string>() };
    const settings = { get: async () => ({ timezone: 'Asia/Kolkata', weekendDays: [0, 6], treatMissingAttendanceAsAbsent: false }) };
    const events = { emit: jest.fn() };
    svc = new PayrollService(
      runs as never,
      fakeSlips(slipStore) as never,
      {} as never,
      users as never,
      comp as never,
      attendance as never,
      holidays as never,
      events as never,
      {} as never,
      {} as never,
      settings as never,
    );
  });

  it('keeps adjustments and payslip ids when the run is recomputed', async () => {
    await svc.recompute(String(runId));
    expect(slipStore).toHaveLength(1);
    const slipId = slipStore[0]!.id;
    expect(slipStore[0]!.netPaise).toBe(30_000_00); // probation staff are paid; no LOP for unmarked days

    const afterAdd = await svc.addAdjustment(slipId, { kind: 'BONUS', reason: 'Diwali bonus', amountPaise: 5_000_00 });
    expect(afterAdd.adjustments).toHaveLength(1);
    expect(afterAdd.netPaise).toBe(35_000_00);
    expect(run.totalNetPaise).toBe(35_000_00);

    await svc.recompute(String(runId));
    expect(slipStore).toHaveLength(1);
    expect(slipStore[0]!.id).toBe(slipId);
    expect(slipStore[0]!.adjustments).toEqual([{ kind: 'BONUS', reason: 'Diwali bonus', amountPaise: 5_000_00 }]);
    expect(slipStore[0]!.netPaise).toBe(35_000_00);
    expect(run.totalNetPaise).toBe(35_000_00);

    const afterRemove = await svc.removeAdjustment(slipId, 0);
    expect(afterRemove.netPaise).toBe(30_000_00);
  });

  it('lists people without compensation as skipped', async () => {
    comp.effectiveFor.mockResolvedValueOnce(null);
    await svc.recompute(String(runId));
    expect(slipStore).toHaveLength(0);
    expect(run.skipped).toEqual([expect.objectContaining({ name: 'Priya', reason: PayrollSkipReason.NO_COMPENSATION })]);
  });

  it('refuses adjustments once the run is finalized', async () => {
    await svc.recompute(String(runId));
    run.status = PayrollStatus.FINALIZED;
    await expect(
      svc.addAdjustment(slipStore[0]!.id, { kind: 'BONUS', reason: 'Late bonus', amountPaise: 100 }),
    ).rejects.toThrow();
  });
});
