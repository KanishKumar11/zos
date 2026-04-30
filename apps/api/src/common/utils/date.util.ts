// Date helpers used across attendance, leave, and payroll modules.
import {
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isWeekend,
  startOfDay,
  startOfMonth,
} from 'date-fns';

export {
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isWeekend,
  startOfDay,
  startOfMonth,
};

/** Inclusive day count between two dates. */
export const inclusiveDayCount = (from: Date, to: Date): number =>
  Math.max(0, differenceInCalendarDays(to, from) + 1);

/** Format a date as YYYY-MM-DD. */
export const ymd = (d: Date): string => format(d, 'yyyy-MM-dd');
