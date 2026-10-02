// Pure payroll maths — no database, so it can be unit tested. PayrollService feeds it data.
//
// Loss of pay (LOP) rules:
//   • Working days = days in the month that are not weekend days and not (non-optional) holidays.
//     The per-day rate is base pay ÷ working days in the whole month.
//   • Only working days that have already happened count: up to today for the current month,
//     the whole month for past months, nothing for future months.
//   • A counted day is unpaid only when it is marked ABSENT (HALF_DAY = half a day unpaid).
//     Days with no attendance record are paid, unless the workspace opts into
//     "treat missing attendance as absent".
//   • Approved leave (LEAVE) and HOLIDAY entries are paid.
//   • Working days before the person's joining date are unpaid (they weren't employed yet).
import { AttendanceStatus } from '@agency/shared';

export interface AttendanceDay {
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
}

export interface AttendanceSummaryInput {
  /** YYYY-MM */
  month: string;
  /** Today's date (YYYY-MM-DD) in the workspace timezone. */
  today: string;
  /** 0 = Sunday … 6 = Saturday. */
  weekendDays: readonly number[];
  /** Non-optional holiday dates (YYYY-MM-DD). */
  holidays: ReadonlySet<string>;
  entries: readonly AttendanceDay[];
  treatMissingAsAbsent: boolean;
  /** YYYY-MM-DD; working days before this are unpaid. */
  joinedOn?: string;
}

export interface AttendanceSummary {
  /** Working days in the whole month (pay rate denominator). */
  workingDays: number;
  /** Working days that have happened so far (what attendance was checked against). */
  elapsedWorkingDays: number;
  presentDays: number;
  leaveDays: number;
  absentDays: number;
  /** Elapsed working days with no attendance record. */
  unmarkedDays: number;
  /** Working days before the joining date. */
  notJoinedDays: number;
  lopDays: number;
}

/** Every date of a YYYY-MM month as YYYY-MM-DD, with its weekday (0 = Sunday). */
export function monthDates(month: string): { date: string; weekday: number }[] {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) throw new Error(`Invalid month: ${month}`);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out: { date: string; weekday: number }[] = [];
  for (let d = 1; d <= days; d++) {
    const dt = new Date(Date.UTC(y, m - 1, d));
    out.push({ date: dt.toISOString().slice(0, 10), weekday: dt.getUTCDay() });
  }
  return out;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function summarizeAttendance(input: AttendanceSummaryInput): AttendanceSummary {
  const weekend = new Set(input.weekendDays);
  const byDate = new Map(input.entries.map((e) => [e.date, e.status]));
  let workingDays = 0;
  let elapsed = 0;
  let present = 0;
  let leave = 0;
  let absent = 0;
  let unmarked = 0;
  let notJoined = 0;
  let lop = 0;

  for (const { date, weekday } of monthDates(input.month)) {
    if (weekend.has(weekday) || input.holidays.has(date)) continue;
    workingDays++;
    if (date > input.today) continue; // hasn't happened yet
    elapsed++;
    if (input.joinedOn && date < input.joinedOn) {
      notJoined++;
      lop++;
      continue;
    }
    const status = byDate.get(date);
    switch (status) {
      case AttendanceStatus.PRESENT:
        present++;
        break;
      case AttendanceStatus.HALF_DAY:
        present += 0.5;
        absent += 0.5;
        lop += 0.5;
        break;
      case AttendanceStatus.ABSENT:
        absent++;
        lop++;
        break;
      case AttendanceStatus.LEAVE:
      case AttendanceStatus.HOLIDAY:
        leave++;
        break;
      default:
        unmarked++;
        if (input.treatMissingAsAbsent) lop++;
    }
  }

  return {
    workingDays,
    elapsedWorkingDays: elapsed,
    presentDays: round1(present),
    leaveDays: leave,
    absentDays: round1(absent),
    unmarkedDays: unmarked,
    notJoinedDays: notJoined,
    lopDays: round1(lop),
  };
}

export interface PayTerms {
  baseAmount: number;
  hra: number;
  specialAllowance: number;
  providentFundEmployee: number;
  professionalTax: number;
  tdsMonthly: number;
}

export interface Adjustment {
  kind: 'BONUS' | 'DEDUCTION';
  amountPaise: number;
}

export interface PayslipBreakdownValues {
  baseAmount: number;
  hra: number;
  specialAllowance: number;
  lopDeduction: number;
  providentFundEmployee: number;
  professionalTax: number;
  tdsMonthly: number;
  lateDeduction: number;
  bonusPaise: number;
  manualDeductionPaise: number;
}

/** LOP deduction on base pay: base × unpaid days ÷ working days in the month. */
export function lopDeduction(baseAmount: number, lopDays: number, workingDays: number): number {
  if (workingDays <= 0 || lopDays <= 0) return 0;
  return Math.min(baseAmount, Math.round((baseAmount * lopDays) / workingDays));
}

/** Gross / deductions / net from a breakdown plus manual adjustments. */
export function totalsFor(
  breakdown: Omit<PayslipBreakdownValues, 'bonusPaise' | 'manualDeductionPaise'>,
  adjustments: readonly Adjustment[],
): { breakdown: PayslipBreakdownValues; grossPaise: number; deductionsPaise: number; netPaise: number } {
  const bonusPaise = adjustments.filter((a) => a.kind === 'BONUS').reduce((s, a) => s + a.amountPaise, 0);
  const manualDeductionPaise = adjustments
    .filter((a) => a.kind === 'DEDUCTION')
    .reduce((s, a) => s + a.amountPaise, 0);
  const grossPaise = breakdown.baseAmount + breakdown.hra + breakdown.specialAllowance + bonusPaise;
  const deductionsPaise =
    breakdown.lopDeduction +
    breakdown.providentFundEmployee +
    breakdown.professionalTax +
    breakdown.tdsMonthly +
    breakdown.lateDeduction +
    manualDeductionPaise;
  return {
    breakdown: { ...breakdown, bonusPaise, manualDeductionPaise },
    grossPaise,
    deductionsPaise,
    netPaise: Math.max(0, grossPaise - deductionsPaise),
  };
}

/** Today's date (YYYY-MM-DD) in a timezone, e.g. Asia/Kolkata. Falls back to UTC on a bad zone. */
export function todayIn(timeZone: string | undefined, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
