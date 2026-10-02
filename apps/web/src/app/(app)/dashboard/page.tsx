// Dashboard — owner: the agency's money and what needs attention; team: my work and my earnings.
'use client';

import { ArrowRight, CalendarClock, CheckCircle2, Megaphone, Receipt, Send } from 'lucide-react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, Legend, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Role, TaskStatus } from '@agency/shared';

import { cn } from '@/lib/cn';
import { todayLocal } from '@/lib/form';
import { formatDate, formatPaise } from '@/lib/formatters';
import { useAuthStore } from '@/store/auth.store';
import { useQuickActions } from '@/store/quick-actions.store';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartTooltip } from '@/components/ui/chart-tooltip';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/states';
import { useOwnerCharts, useOwnerDashboard } from '@/features/dashboard/dashboard.hooks';
import { useAnnouncements } from '@/features/notifications/notifications.hooks';
import { useImportStatus, useMyEarnings, useOwed } from '@/features/payouts/payouts.hooks';
import { useMyTasks } from '@/features/tasks/tasks.hooks';

import { BillingReminders } from './billing-reminders';
import { DashboardNotifications } from './dashboard-notifications';
import { MoneyOverview } from './money-overview';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortMonth = (m: string) => MONTHS[Number(m.split('-')[1]) - 1] ?? m;
const rupees = (paise: number) => Math.round(paise / 100);

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const firstName = user?.name?.split(' ')[0];
  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
        description={new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
        action={user?.role === Role.OWNER ? <OwnerQuickActions /> : undefined}
      />
      {user?.role === Role.OWNER ? <OwnerDashboard /> : <MemberDashboard />}
    </div>
  );
}

function OwnerQuickActions() {
  const openLogPayment = useQuickActions((s) => s.openLogPayment);
  return (
    <>
      <Button size="sm" variant="outline" asChild>
        <Link href="/invoices?new=1">
          <Receipt className="mr-1.5 h-3.5 w-3.5" /> New invoice
        </Link>
      </Button>
      <Button size="sm" onClick={() => openLogPayment()}>
        <Send className="mr-1.5 h-3.5 w-3.5" /> Log payment
      </Button>
    </>
  );
}

function OwnerDashboard() {
  const owner = useOwnerDashboard(true);
  const charts = useOwnerCharts(true);
  const owed = useOwed();
  const imports = useImportStatus();
  const d = owner.data;
  const loading = owner.isLoading;
  const weOwe = [...(owed.data?.team ?? []), ...(owed.data?.freelancers ?? [])].reduce((s, r) => s + r.pendingPaise, 0);
  const month = new Date().toLocaleString('en-IN', { month: 'long' });

  const chartData = (charts.data?.revenueByMonth ?? []).map((r, i) => {
    const costs =
      (charts.data?.payrollByMonth[i]?.totalNetPaise ?? 0) +
      (charts.data?.expensesByMonth[i]?.totalPaise ?? 0) +
      (charts.data?.freelancerByMonth[i]?.totalPaise ?? 0) +
      (charts.data?.teamPayoutsByMonth?.[i]?.totalPaise ?? 0);
    return {
      month: shortMonth(r.month),
      Revenue: rupees(r.collectedPaise + (charts.data?.incomeByMonth?.[i]?.totalPaise ?? 0)),
      Costs: rupees(costs),
      Profit: rupees(charts.data?.profitByMonth[i]?.profitPaise ?? 0),
      'Team payouts': rupees(charts.data?.teamPayoutsByMonth?.[i]?.totalPaise ?? 0),
      Freelancers: rupees(charts.data?.freelancerByMonth[i]?.totalPaise ?? 0),
      Payroll: rupees(charts.data?.payrollByMonth[i]?.totalNetPaise ?? 0),
      Expenses: rupees(charts.data?.expensesByMonth[i]?.totalPaise ?? 0),
    };
  });
  const cb = d?.costBreakdownThisMonth;

  return (
    <div className="space-y-6">
      {imports.data?.pending && (
        <Link href="/payments" className="flex items-center gap-3 rounded-lg border border-sky-600/30 bg-sky-600/5 px-4 py-3 text-sm hover:bg-sky-600/10">
          <span className="flex-1">
            <span className="font-medium">Older payments need importing.</span> Bring them into Payments out so balances and profit are complete.
          </span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
      <DashboardNotifications />
      <BillingReminders />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label={`Collected in ${month}`} loading={loading} value={formatPaise(d?.revenueThisMonth ?? 0)} hint={`${formatPaise(d?.revenueThisFinancialYear ?? 0)} this FY · excl. GST`} href="/invoices" />
        <StatCard
          label={`Profit in ${month}`}
          loading={loading}
          tone={(d?.profitThisMonth ?? 0) < 0 ? 'danger' : 'success'}
          value={formatPaise(d?.profitThisMonth ?? 0)}
          hint={`${formatPaise(d?.profitThisFinancialYear ?? 0)} ${d?.fyLabel ?? 'this FY'}`}
        />
        <StatCard label="Clients owe you" loading={loading} tone={(d?.invoices.outstanding ?? 0) > 0 ? 'warning' : 'default'} value={formatPaise(d?.invoices.outstanding ?? 0)} href="/invoices?status=open" />
        <StatCard label="Overdue" loading={loading} tone={(d?.invoices.overdue ?? 0) > 0 ? 'danger' : 'default'} value={formatPaise(d?.invoices.overdue ?? 0)} href="/invoices?status=OVERDUE" />
        <StatCard label="You owe team & freelancers" loading={owed.isLoading} tone={weOwe > 0 ? 'warning' : 'default'} value={formatPaise(weOwe)} href="/payments" />
        <StatCard label="Active projects" loading={loading} value={String(d?.activeProjects ?? 0)} href="/projects?status=ACTIVE" />
      </div>

      <Card className="overflow-hidden">
        <MoneyOverview />
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue vs costs — last 12 months</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {charts.isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={2} barSize={10}>
                    <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => (Math.abs(v) >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${Math.round(v / 1000)}k`)} />
                    <Tooltip content={<ChartTooltip formatValue={(v) => `₹${Math.round(v).toLocaleString('en-IN')}`} />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={8} />
                    <Bar dataKey="Revenue" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Costs" fill="hsl(var(--muted-foreground))" opacity={0.45} radius={[3, 3, 0, 0]} />
                    <Line type="monotone" dataKey="Profit" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Where money went in {month}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading || !cb ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              (() => {
                const parts = [
                  { label: 'Team payouts', value: cb.teamPayoutsPaise, href: '/payments?payeeType=MEMBER&range=this-month' },
                  { label: 'Freelancers', value: cb.freelancerPayoutsPaise, href: '/payments?payeeType=FREELANCER&range=this-month' },
                  { label: 'Payroll', value: cb.payrollPaise, href: '/payroll' },
                  { label: 'Expenses', value: cb.expensesPaise, href: '/expenses?range=this-month' },
                ];
                const total = parts.reduce((s, p) => s + p.value, 0);
                if (!total) return <p className="text-sm text-muted-foreground">Nothing spent yet this month.</p>;
                return (
                  <>
                    <p className="text-2xl font-semibold tabular-nums">{formatPaise(total)}</p>
                    {parts.map((p) => (
                      <Link key={p.label} href={p.href} className="block space-y-1 rounded-md p-1 hover:bg-muted/40">
                        <div className="flex justify-between text-sm">
                          <span>{p.label}</span>
                          <span className="tabular-nums">{formatPaise(p.value)}</span>
                        </div>
                        <ProgressBar value={p.value} max={total} />
                      </Link>
                    ))}
                    <p className="text-xs text-muted-foreground">Expected expenses next month: {formatPaise(d?.expensesNextMonth ?? 0)}</p>
                  </>
                );
              })()
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team payouts by month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            {charts.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barSize={12} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<ChartTooltip formatValue={(v) => `₹${Math.round(v).toLocaleString('en-IN')}`} />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={8} />
                  <Bar dataKey="Team payouts" stackId="c" fill="hsl(var(--primary))" />
                  <Bar dataKey="Freelancers" stackId="c" fill="hsl(var(--primary))" opacity={0.55} />
                  <Bar dataKey="Payroll" stackId="c" fill="hsl(var(--muted-foreground))" opacity={0.5} />
                  <Bar dataKey="Expenses" stackId="c" fill="hsl(var(--muted-foreground))" opacity={0.25} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MemberDashboard() {
  const tasks = useMyTasks();
  const earnings = useMyEarnings();
  const announcements = useAnnouncements();
  const today = todayLocal();
  const open = (tasks.data ?? []).filter((t) => t.status !== TaskStatus.DONE);
  const overdue = open.filter((t) => t.dueDate && t.dueDate.slice(0, 10) < today);
  const dueToday = open.filter((t) => t.dueDate?.slice(0, 10) === today);
  const upcoming = [...open].sort((a, b) => (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9')).slice(0, 6);
  const e = earnings.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open tasks" loading={tasks.isLoading} value={String(open.length)} href="/tasks" />
        <StatCard label="Overdue" loading={tasks.isLoading} tone={overdue.length ? 'danger' : 'default'} value={String(overdue.length)} hint={dueToday.length ? `${dueToday.length} due today` : undefined} href="/tasks" />
        <StatCard label="Received this month" loading={earnings.isLoading} value={formatPaise(e?.totals.thisMonthPaise ?? 0)} href="/earnings?tab=payments" />
        <StatCard label="Pending payments" loading={earnings.isLoading} tone={(e?.totals.pendingPaise ?? 0) > 0 ? 'warning' : 'default'} value={formatPaise(e?.totals.pendingPaise ?? 0)} href="/earnings" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Up next</CardTitle>
            <Link href="/tasks" className="text-xs text-primary hover:underline">
              All my tasks
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {upcoming.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="You're all clear" description="No open tasks assigned to you." className="py-8" />
            ) : (
              <ul className="divide-y">
                {upcoming.map((t) => {
                  const late = t.dueDate && t.dueDate.slice(0, 10) < today;
                  return (
                    <li key={t._id}>
                      <Link href={`/tasks/${t._id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/30">
                        <span className="flex-1 truncate text-sm">{t.title}</span>
                        <StatusBadge status={t.status} />
                        {t.dueDate && (
                          <span className={cn('flex items-center gap-1 text-xs', late ? 'text-destructive' : 'text-muted-foreground')}>
                            <CalendarClock className="h-3 w-3" /> {formatDate(t.dueDate)}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>My projects</CardTitle>
              <Link href="/earnings" className="text-xs text-primary hover:underline">
                Earnings
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {(e?.projects ?? []).filter((p) => p.projectId).length === 0 ? (
                <EmptyState title="No projects yet" className="py-6" />
              ) : (
                <ul className="divide-y">
                  {e!.projects
                    .filter((p) => p.projectId)
                    .slice(0, 5)
                    .map((p) => (
                      <li key={p.projectId}>
                        <Link href={`/projects/${p.projectId}`} className="block px-5 py-2.5 hover:bg-muted/30">
                          <div className="flex justify-between gap-2 text-sm">
                            <span className="truncate font-medium">{p.projectName}</span>
                            {p.pendingPaise > 0 && <span className="text-xs text-amber-700 dark:text-amber-500">{formatPaise(p.pendingPaise)} pending</span>}
                          </div>
                          {p.agreedPaise > 0 && <ProgressBar value={p.paidPaise} max={p.agreedPaise} className="mt-1.5" />}
                        </Link>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Announcements</CardTitle>
              <Link href="/announcements" className="text-xs text-primary hover:underline">
                All
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {(announcements.data ?? []).length === 0 ? (
                <EmptyState icon={Megaphone} title="Nothing new" className="py-6" />
              ) : (
                <ul className="divide-y">
                  {announcements.data!.slice(0, 3).map((a) => (
                    <li key={a._id}>
                      <Link href="/announcements" className="block px-5 py-2.5 hover:bg-muted/30">
                        <p className="truncate text-sm font-medium">{a.title}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(a.publishedAt ?? a.createdAt)}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
