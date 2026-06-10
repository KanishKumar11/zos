'use client';

import Link from 'next/link';

import { useDashboardNotifications } from '@/features/dashboard/dashboard.hooks';

export function DashboardNotifications() {
  const q = useDashboardNotifications(true);
  if (q.isLoading || !q.data) return null;

  const { birthdays, payrollReminder } = q.data;
  if (!birthdays.length && !payrollReminder) return null;

  return (
    <div className="p-6 md:p-12 border-b border-border space-y-3">
      <p className="text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground mb-4">Notifications</p>

      {payrollReminder && (
        <div className="flex items-center justify-between border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 rounded-lg px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Payroll not run for {payrollReminder.month}</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Run payroll to generate payslips for your team.</p>
          </div>
          <Link
            href="/payroll"
            className="ml-4 shrink-0 rounded-md bg-amber-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
          >
            Go to Payroll →
          </Link>
        </div>
      )}

      {birthdays.map((b) => (
        <div
          key={b.userId}
          className="flex items-center justify-between border border-violet-200 bg-violet-50 dark:bg-violet-950/20 dark:border-violet-800 rounded-lg px-4 py-3"
        >
          <div>
            <p className="text-sm font-semibold text-violet-900 dark:text-violet-200">
              {b.daysUntil === 0 ? '🎂' : '🎉'}{' '}
              {b.daysUntil === 0
                ? `Today is ${b.name}'s birthday!`
                : `${b.name}'s birthday in ${b.daysUntil} day${b.daysUntil === 1 ? '' : 's'}`}
            </p>
            <p className="text-xs text-violet-700 dark:text-violet-400 mt-0.5">{b.dateLabel}</p>
          </div>
          <Link
            href={`/team/${b.userId}`}
            className="ml-4 shrink-0 rounded-md bg-violet-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-violet-700"
          >
            View Profile →
          </Link>
        </div>
      ))}
    </div>
  );
}
