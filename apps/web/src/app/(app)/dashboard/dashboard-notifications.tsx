// Owner notifications — payroll not yet run this month, and upcoming team birthdays.
'use client';

import { CakeSlice, Wallet } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/viz';
import { AttentionRow } from '@/features/dashboard/attention-row';
import { useDashboardNotifications } from '@/features/dashboard/dashboard.hooks';

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

export function DashboardNotifications() {
  const q = useDashboardNotifications(true);
  if (q.isLoading || !q.data) return null;

  const { birthdays, payrollReminder } = q.data;
  if (!birthdays.length && !payrollReminder) return null;

  return (
    <div className="space-y-2">
      {payrollReminder && (
        <AttentionRow
          icon={Wallet}
          tone="warning"
          title={`Payroll hasn't been run for ${monthLabel(payrollReminder.month)}`}
          sub="Run payroll to generate payslips for your team."
          action={
            <Button size="sm" variant="outline" asChild>
              <Link href="/payroll">Run payroll</Link>
            </Button>
          }
        />
      )}

      {birthdays.length > 0 && (
        <AttentionRow
          icon={CakeSlice}
          tone="info"
          title={
            birthdays.length === 1
              ? birthdays[0]!.daysUntil === 0
                ? `It's ${birthdays[0]!.name}'s birthday today`
                : `${birthdays[0]!.name}'s birthday is in ${birthdays[0]!.daysUntil} day${birthdays[0]!.daysUntil === 1 ? '' : 's'}`
              : `${birthdays.length} birthdays this week`
          }
          sub={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {birthdays.map((b) => (
                <Link key={b.userId} href={`/team/${b.userId}`} className="inline-flex items-center gap-1.5 hover:text-foreground hover:underline">
                  <Avatar id={b.userId} name={b.name} size="xs" />
                  {b.name} · {b.daysUntil === 0 ? 'today' : b.dateLabel}
                </Link>
              ))}
            </span>
          }
          action={
            birthdays.length === 1 ? (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/team/${birthdays[0]!.userId}`}>Say hello</Link>
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
