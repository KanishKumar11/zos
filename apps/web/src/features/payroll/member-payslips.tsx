// Payslips of one person (OWNER view on the team member page), expandable breakdown. Pass `own` when
// the viewer is the payslip owner (their own pay) so amounts show whatever their role.
'use client';

import { ChevronDown, ChevronUp, Download } from 'lucide-react';
import { useState } from 'react';

import { env } from '@/lib/env';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/states';
import { Skeleton } from '@/components/ui/skeleton';
import { Price } from '@/components/viz';

import { monthTitle, useUserPayslips, type PayslipRow } from './payroll.hooks';

export function MemberPayslips({ userId, own = false }: { userId: string; own?: boolean }) {
  const payslips = useUserPayslips(userId);
  const [open, setOpen] = useState<string | null>(null);
  const rows = payslips.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payslips</CardTitle>
      </CardHeader>
      <CardContent>
        {payslips.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : payslips.isError ? (
          <ErrorState error={payslips.error} onRetry={() => payslips.refetch()} className="py-6" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payslips yet. They appear here once a payroll run includes this person.</p>
        ) : (
          <div className="divide-y">
            {rows.map((s) => {
              const isOpen = open === s._id;
              return (
                <div key={s._id} className="py-2">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : s._id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-3 py-1 text-left text-sm"
                  >
                    <span className="font-medium">{monthTitle(s.month)}</span>
                    <span className="flex items-center gap-4 text-xs tabular-nums">
                      <span className="hidden text-muted-foreground sm:inline">
                        Gross <Price paise={s.grossPaise} currency={s.currency} own={own} />
                      </span>
                      <span className="hidden text-destructive sm:inline">
                        {s.deductionsPaise > 0 ? (
                          <>
                            −<Price paise={s.deductionsPaise} currency={s.currency} own={own} />
                          </>
                        ) : (
                          <span className="text-muted-foreground">No deductions</span>
                        )}
                      </span>
                      <span className="font-semibold">
                        Net <Price paise={s.netPaise} currency={s.currency} own={own} />
                      </span>
                      {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                  {isOpen && <PayslipBreakdown slip={s} own={own} />}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PayslipBreakdown({ slip, own = false }: { slip: PayslipRow; own?: boolean }) {
  const b = slip.breakdown;
  const earnings = [
    { label: 'Base', value: b.baseAmount },
    { label: 'HRA', value: b.hra },
    { label: 'Special allowance', value: b.specialAllowance },
    { label: 'Bonus', value: b.bonusPaise },
  ].filter((r) => r.value > 0);
  const deductions = [
    { label: 'Loss of pay', value: b.lopDeduction },
    { label: 'Provident fund', value: b.providentFundEmployee },
    { label: 'Professional tax', value: b.professionalTax },
    { label: 'TDS', value: b.tdsMonthly },
    { label: 'Late deduction', value: b.lateDeduction },
    { label: 'Other deductions', value: b.manualDeductionPaise },
  ].filter((r) => r.value > 0);

  return (
    <div className="mt-2 grid gap-4 rounded-md border bg-muted/20 p-3 text-xs md:grid-cols-3">
      <div>
        <p className="mb-1 font-medium text-muted-foreground">Earnings</p>
        {earnings.length === 0 ? (
          <p className="text-muted-foreground">—</p>
        ) : (
          earnings.map((r) => (
            <div key={r.label} className="flex justify-between py-0.5">
              <span className="text-muted-foreground">{r.label}</span>
              <Price paise={r.value} currency={slip.currency} own={own} />
            </div>
          ))
        )}
      </div>
      <div>
        <p className="mb-1 font-medium text-muted-foreground">Deductions</p>
        {deductions.length === 0 ? (
          <p className="text-muted-foreground">—</p>
        ) : (
          deductions.map((r) => (
            <div key={r.label} className="flex justify-between py-0.5">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="text-destructive">
                −<Price paise={r.value} currency={slip.currency} own={own} />
              </span>
            </div>
          ))
        )}
        {slip.adjustments.length > 0 && (
          <div className="mt-2 border-t pt-2">
            {slip.adjustments.map((a, i) => (
              <div key={i} className="flex justify-between py-0.5">
                <span className="text-muted-foreground">{a.reason || (a.kind === 'BONUS' ? 'Bonus' : 'Deduction')}</span>
                <span className={a.kind === 'DEDUCTION' ? 'text-destructive' : 'text-success'}>
                  {a.kind === 'DEDUCTION' ? '−' : '+'}
                  <Price paise={a.amountPaise} currency={slip.currency} own={own} />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col justify-between gap-2">
        <div>
          <p className="mb-1 font-medium text-muted-foreground">Attendance</p>
          <p>
            {slip.workingDays} working days
            {slip.lopDays > 0 ? ` · ${slip.lopDays} unpaid` : ' · no unpaid days'}
          </p>
          {(slip.unmarkedDays ?? 0) > 0 && (
            <p className="text-muted-foreground">{slip.unmarkedDays} day(s) had no attendance record</p>
          )}
        </div>
        <a
          href={`${env.apiBaseUrl}/payroll/payslips/${slip._id}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-brand-ink hover:underline"
        >
          <Download className="h-3.5 w-3.5" /> Download PDF
        </a>
      </div>
    </div>
  );
}
