// Recurring costs worked out from logged expenses (monthly / yearly repeats).
//
// A repeat is logged as a copy that points at the expense it came from (`repeatOfId`), so the newest
// entry of each chain is the one that isn't pointed at. Entries logged by hand each period (no
// `repeatOfId`) are folded together by title + category + cadence. A series whose next period is
// long past is treated as stopped and left out.
import { isRecurring, nextPeriodYmd, storedYmd } from './expense-meta';
import type { ExpenseRow } from './expenses.hooks';
import { daysBetween } from './money-time';

export interface RecurringSeries {
  /** The newest entry of the series — repeating it logs the next period. */
  row: ExpenseRow;
  cadence: 'MONTHLY' | 'YEARLY';
  /** yyyy-mm-dd of the next period. */
  nextDue: string;
  /** What it costs per month (yearly ÷ 12). */
  monthlyPaise: number;
  /** The next period has started but hasn't been logged yet. */
  overdue: boolean;
}

/** Days after the next period after which a series counts as stopped. */
const LAPSE_DAYS = { MONTHLY: 62, YEARLY: 92 } as const;

export function recurringSeries(rows: ExpenseRow[], today: string): RecurringSeries[] {
  const recurring = rows.filter((r) => isRecurring(r.recurring) && r.amountPaise > 0);
  const repeated = new Set(recurring.map((r) => r.repeatOfId).filter(Boolean));
  const latest = new Map<string, ExpenseRow>();
  for (const r of recurring) {
    if (repeated.has(r._id)) continue;
    const key = `${r.recurring}|${r.category}|${r.title.trim().toLowerCase()}`;
    const prev = latest.get(key);
    if (!prev || storedYmd(r.date) > storedYmd(prev.date)) latest.set(key, r);
  }
  const out: RecurringSeries[] = [];
  for (const row of latest.values()) {
    const cadence = row.recurring as 'MONTHLY' | 'YEARLY';
    const nextDue = nextPeriodYmd(storedYmd(row.date), cadence);
    if (daysBetween(nextDue, today) > LAPSE_DAYS[cadence]) continue;
    out.push({
      row,
      cadence,
      nextDue,
      monthlyPaise: cadence === 'MONTHLY' ? row.amountPaise : Math.round(row.amountPaise / 12),
      overdue: nextDue <= today,
    });
  }
  return out.sort((a, b) => a.nextDue.localeCompare(b.nextDue));
}

/** What the active series should cost in a given month (yyyy-mm): every monthly one, plus yearly ones falling due. */
export function expectedInMonth(series: RecurringSeries[], monthKey: string): number {
  return series.reduce((sum, s) => {
    if (s.cadence === 'MONTHLY') return sum + s.row.amountPaise;
    return s.nextDue.slice(0, 7) === monthKey ? sum + s.row.amountPaise : sum;
  }, 0);
}
