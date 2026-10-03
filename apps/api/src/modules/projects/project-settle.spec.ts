import { settleOutcome } from './project-settle';

describe('settleOutcome', () => {
  it('pays exactly what is still owed', () => {
    expect(settleOutcome(50_000_00, 20_000_00, 'PAY_REST')).toEqual({ payPaise: 30_000_00 });
  });
  it('pays nothing when already fully paid or over-paid', () => {
    expect(settleOutcome(50_000_00, 50_000_00, 'PAY_REST')).toEqual({ payPaise: 0 });
    expect(settleOutcome(50_000_00, 60_000_00, 'PAY_REST')).toEqual({ payPaise: 0 });
  });
  it('settles at what was paid by lowering the fee, never raising it', () => {
    expect(settleOutcome(50_000_00, 20_000_00, 'SETTLE_AT_PAID')).toEqual({ payPaise: 0, newAgreed: 20_000_00 });
    expect(settleOutcome(50_000_00, 60_000_00, 'SETTLE_AT_PAID')).toEqual({ payPaise: 0 });
  });
  it('settles a fee with no payments at zero', () => {
    expect(settleOutcome(10_000_00, 0, 'SETTLE_AT_PAID')).toEqual({ payPaise: 0, newAgreed: 0 });
  });
  it('keeps the balance owed', () => {
    expect(settleOutcome(50_000_00, 20_000_00, 'KEEP_OWED')).toEqual({ payPaise: 0 });
  });
});
