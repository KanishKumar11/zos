import { AttendanceStatus } from '@agency/shared';

import { lopDeduction, monthDates, summarizeAttendance, todayIn, totalsFor } from './payroll-calc';

// September 2026: 30 days, starts on a Tuesday. Weekends Sat/Sun → 22 working days.
const base = {
  month: '2026-09',
  weekendDays: [0, 6],
  holidays: new Set<string>(),
  entries: [] as { date: string; status: AttendanceStatus }[],
  treatMissingAsAbsent: false,
};

describe('summarizeAttendance (LOP)', () => {
  it('counts working days excluding weekends and holidays', () => {
    expect(monthDates('2026-09')).toHaveLength(30);
    const s = summarizeAttendance({ ...base, today: '2026-10-02' });
    expect(s.workingDays).toBe(22);
    const withHoliday = summarizeAttendance({ ...base, today: '2026-10-02', holidays: new Set(['2026-09-15']) });
    expect(withHoliday.workingDays).toBe(21);
  });

  it('does not treat missing check-ins as unpaid by default', () => {
    const s = summarizeAttendance({ ...base, today: '2026-10-02' });
    expect(s.unmarkedDays).toBe(22);
    expect(s.lopDays).toBe(0);
  });

  it('only counts days explicitly marked ABSENT (half days count half)', () => {
    const s = summarizeAttendance({
      ...base,
      today: '2026-10-02',
      entries: [
        { date: '2026-09-01', status: AttendanceStatus.PRESENT },
        { date: '2026-09-02', status: AttendanceStatus.ABSENT },
        { date: '2026-09-03', status: AttendanceStatus.HALF_DAY },
        { date: '2026-09-04', status: AttendanceStatus.LEAVE },
        { date: '2026-09-05', status: AttendanceStatus.ABSENT }, // Saturday — ignored
      ],
    });
    expect(s.lopDays).toBe(1.5);
    expect(s.absentDays).toBe(1.5);
    expect(s.presentDays).toBe(1.5);
    expect(s.leaveDays).toBe(1);
  });

  it('never counts future days of the current month', () => {
    // Today is 2026-09-10 (Thursday): 1,2,3,4,7,8,9,10 = 8 elapsed working days.
    const s = summarizeAttendance({ ...base, today: '2026-09-10', treatMissingAsAbsent: true });
    expect(s.elapsedWorkingDays).toBe(8);
    expect(s.lopDays).toBe(8);
    expect(s.workingDays).toBe(22);
  });

  it('counts nothing for a future month', () => {
    const s = summarizeAttendance({ ...base, today: '2026-08-20', treatMissingAsAbsent: true });
    expect(s.elapsedWorkingDays).toBe(0);
    expect(s.lopDays).toBe(0);
  });

  it('treats missing attendance as absent only when the workspace opts in', () => {
    const s = summarizeAttendance({
      ...base,
      today: '2026-10-02',
      treatMissingAsAbsent: true,
      entries: [{ date: '2026-09-01', status: AttendanceStatus.PRESENT }],
    });
    expect(s.lopDays).toBe(21);
  });

  it('makes working days before the joining date unpaid', () => {
    const s = summarizeAttendance({ ...base, today: '2026-10-02', joinedOn: '2026-09-07' });
    // 1,2,3,4 Sept are working days before joining.
    expect(s.notJoinedDays).toBe(4);
    expect(s.lopDays).toBe(4);
  });
});

describe('pay maths', () => {
  it('prorates LOP on base pay and caps it at base', () => {
    expect(lopDeduction(22_000_00, 2, 22)).toBe(2_000_00);
    expect(lopDeduction(22_000_00, 0, 22)).toBe(0);
    expect(lopDeduction(22_000_00, 30, 22)).toBe(22_000_00);
    expect(lopDeduction(22_000_00, 2, 0)).toBe(0);
  });

  it('applies bonuses and deductions to the totals', () => {
    const t = totalsFor(
      {
        baseAmount: 50_000_00,
        hra: 10_000_00,
        specialAllowance: 0,
        lopDeduction: 1_000_00,
        providentFundEmployee: 1_800_00,
        professionalTax: 200_00,
        tdsMonthly: 0,
        lateDeduction: 0,
      },
      [
        { kind: 'BONUS', amountPaise: 5_000_00 },
        { kind: 'DEDUCTION', amountPaise: 500_00 },
      ],
    );
    expect(t.grossPaise).toBe(65_000_00);
    expect(t.deductionsPaise).toBe(3_500_00);
    expect(t.netPaise).toBe(61_500_00);
    expect(t.breakdown.bonusPaise).toBe(5_000_00);
    expect(t.breakdown.manualDeductionPaise).toBe(500_00);
  });

  it('formats today in the workspace timezone', () => {
    // 20:00 UTC on 1 Oct is already 2 Oct in India.
    expect(todayIn('Asia/Kolkata', new Date('2026-10-01T20:00:00Z'))).toBe('2026-10-02');
    expect(todayIn('UTC', new Date('2026-10-01T20:00:00Z'))).toBe('2026-10-01');
  });
});
