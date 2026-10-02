// My earnings — a team member's own money view: what was agreed per project, what's been paid,
// what's still pending, every payment received, and payslips for salaried pay.
'use client';

import { Download, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { PAYOUT_CATEGORY_LABEL, PAYOUT_METHOD_LABEL } from '@agency/shared';

import { csvMoney, downloadCsv } from '@/lib/csv';
import { env } from '@/lib/env';
import { formatDate, formatPaise } from '@/lib/formatters';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/states';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMyPayslips } from '@/features/payroll/payroll.hooks';
import { useMyEarnings } from '@/features/payouts/payouts.hooks';

export default function EarningsPage() {
  const earnings = useMyEarnings();
  const router = useRouter();
  const pathname = usePathname();
  const tab = useSearchParams().get('tab') ?? 'projects';
  const t = earnings.data?.totals;

  const exportPayments = () => {
    const rows = earnings.data?.payouts ?? [];
    downloadCsv(
      'my-payments',
      ['Date', 'Project', 'Kind', 'Method', 'Reference', 'Note', 'Amount (₹)'],
      rows.map((p) => [p.paidAt.slice(0, 10), p.projectName ?? 'General', PAYOUT_CATEGORY_LABEL[p.category], PAYOUT_METHOD_LABEL[p.method], p.reference, p.note, csvMoney(p.amountPaise)]),
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="My earnings" description="What you've agreed, been paid and are still owed, project by project." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Received this month" loading={earnings.isLoading} value={formatPaise(t?.thisMonthPaise ?? 0)} />
        <StatCard label="Received this financial year" loading={earnings.isLoading} value={formatPaise(t?.thisFyPaise ?? 0)} />
        <StatCard label="Received all time" loading={earnings.isLoading} value={formatPaise(t?.allTimePaise ?? 0)} />
        <StatCard label="Still pending" tone={t && t.pendingPaise > 0 ? 'warning' : 'default'} loading={earnings.isLoading} value={formatPaise(t?.pendingPaise ?? 0)} />
      </div>

      <Tabs value={tab} onValueChange={(v) => router.replace(`${pathname}?tab=${v}`, { scroll: false })}>
        <TabsList>
          <TabsTrigger value="projects">By project</TabsTrigger>
          <TabsTrigger value="payments">Payments received</TabsTrigger>
          <TabsTrigger value="payslips">Payslips</TabsTrigger>
        </TabsList>

        <TabsContent value="projects">
          <Card>
            <CardContent className="p-0">
              {earnings.isLoading ? (
                <TableSkeleton rows={3} columns={4} />
              ) : earnings.isError ? (
                <ErrorState error={earnings.error} onRetry={() => earnings.refetch()} />
              ) : (earnings.data?.projects ?? []).length === 0 ? (
                <EmptyState icon={Wallet} title="No project earnings yet" description="When you're added to a project with an agreed fee, it shows up here." />
              ) : (
                <ul className="divide-y">
                  {earnings.data!.projects.map((p) => (
                    <li key={p.projectId ?? 'general'} className="grid gap-2 px-5 py-3.5 sm:grid-cols-[1fr_220px_160px] sm:items-center">
                      <div>
                        {p.projectId ? (
                          <Link href={`/projects/${p.projectId}`} className="font-medium hover:underline">
                            {p.projectName}
                          </Link>
                        ) : (
                          <span className="font-medium">Other payments</span>
                        )}
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          {p.projectStatus && <StatusBadge status={p.projectStatus} />}
                          <span>{p.payoutCount} payment{p.payoutCount === 1 ? '' : 's'}</span>
                        </div>
                      </div>
                      <div>
                        {p.agreedPaise > 0 ? (
                          <>
                            <ProgressBar value={p.paidPaise} max={p.agreedPaise} />
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatPaise(p.paidPaise)} of {formatPaise(p.agreedPaise)}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">{p.projectId ? 'No fee agreed yet' : ''}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">{formatPaise(p.paidPaise)}</p>
                        {p.pendingPaise > 0 && (
                          <p className="text-xs text-amber-700 dark:text-amber-500">{formatPaise(p.pendingPaise)} pending</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={exportPayments} disabled={!earnings.data?.payouts.length}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {(earnings.data?.payouts ?? []).length === 0 ? (
                <EmptyState title="No payments received yet" />
              ) : (
                <ul className="divide-y">
                  {earnings.data!.payouts.map((p) => (
                    <li key={p._id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]">
                      <span className="w-24 shrink-0 text-muted-foreground">{formatDate(p.paidAt)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{p.projectName ?? PAYOUT_CATEGORY_LABEL[p.category]}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {PAYOUT_METHOD_LABEL[p.method]}
                          {p.reference ? ` · ref ${p.reference}` : ''}
                          {p.note ? ` · ${p.note}` : ''}
                        </p>
                      </div>
                      <span className="font-medium tabular-nums">{formatPaise(p.amountPaise, p.currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payslips">
          <Payslips />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Payslips() {
  const slips = useMyPayslips();
  return (
    <Card>
      <CardContent className="p-0">
        {slips.isLoading ? (
          <TableSkeleton rows={3} columns={4} />
        ) : (slips.data ?? []).length === 0 ? (
          <EmptyState title="No payslips" description="Payslips appear here if you're on monthly salary." />
        ) : (
          <ul className="divide-y">
            {slips.data!.map((s) => (
              <li key={s._id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <span className="w-28 font-medium">
                  {new Date(`${s.month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </span>
                <span className="flex-1 text-xs text-muted-foreground">
                  Gross {formatPaise(s.grossPaise, s.currency)} · deductions {formatPaise(s.deductionsPaise, s.currency)}
                </span>
                <span className="font-semibold tabular-nums">{formatPaise(s.netPaise, s.currency)}</span>
                <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                  <a href={`${env.apiBaseUrl}/payroll/payslips/${s._id}/pdf`} target="_blank" rel="noreferrer" aria-label="Download payslip PDF">
                    <Download className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
