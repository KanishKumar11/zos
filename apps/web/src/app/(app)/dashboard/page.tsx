// Dashboard landing — role-aware widgets with charts.
'use client';

import { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Briefcase,
  FileText,
  TrendingUp,
  CheckSquare,
  Clock,
  CreditCard,
  IndianRupee,
  Users,
} from 'lucide-react';
import { Role } from '@agency/shared';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPaise } from '@/lib/formatters';
import { useAuthStore } from '@/store/auth.store';

import {
  useMemberDashboard,
  useOwnerCharts,
  useOwnerDashboard,
  useTeamEarnings,
} from '@/features/dashboard/dashboard.hooks';

const shortMonth = (m: string) => {
  const [, mo] = m.split('-');
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+mo - 1] ?? m;
};
const toINR = (paise: number) => paise / 100;
const fmtINR = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const isOwner = role === Role.OWNER;
  const owner = useOwnerDashboard(isOwner);
  const member = useMemberDashboard();
  const charts = useOwnerCharts(isOwner);

  // Team earnings — pick a month
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [earningsMonth, setEarningsMonth] = useState(currentMonth);
  const teamEarnings = useTeamEarnings(earningsMonth, isOwner);

  // Build merged chart data for revenue vs cost
  const chartData = (charts.data?.revenueByMonth ?? []).map((r, i) => ({
    month: shortMonth(r.month),
    Revenue: Math.round(toINR(r.collectedPaise)),
    Payroll: Math.round(toINR(charts.data?.payrollByMonth[i]?.totalNetPaise ?? 0)),
    Expenses: Math.round(toINR((charts.data?.expensesByMonth[i]?.totalPaise ?? 0) + (charts.data?.freelancerByMonth[i]?.totalPaise ?? 0))),
    Profit: Math.round(toINR(charts.data?.profitByMonth[i]?.profitPaise ?? 0)),
  }));

  return (
    <div className="space-y-10">
      {/* Greeting */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Hi, {user?.name?.split(' ')[0] ?? 'there'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening across your workspace.
        </p>
      </div>

      {/* Owner — agency overview */}
      {isOwner && (
        <>
          <section className="space-y-4">
            <SectionHeader title="Agency overview" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {owner.isLoading ? (
                <StatSkeletons count={4} />
              ) : owner.data ? (
                <>
                  <Stat
                    title="Active projects"
                    value={owner.data.activeProjects.toString()}
                    icon={Briefcase}
                  />
                  <Stat
                    title="Active SOWs"
                    value={owner.data.activeSows.toString()}
                    icon={FileText}
                  />
                  <Stat
                    title="Outstanding"
                    value={formatPaise(owner.data.invoices.outstanding, 'INR')}
                    description={`Overdue ${formatPaise(owner.data.invoices.overdue, 'INR')}`}
                    icon={TrendingUp}
                    iconClassName="text-warning"
                  />
                  <Stat
                    title="Collected"
                    value={formatPaise(owner.data.invoices.collected, 'INR')}
                    description={
                      owner.data.lastPayrollRun
                        ? `Last payroll · ${owner.data.lastPayrollRun.month}`
                        : 'No payroll runs yet'
                    }
                    icon={IndianRupee}
                    iconClassName="text-success"
                  />
                </>
              ) : null}
            </div>
          </section>

          {/* Revenue vs Cost chart */}
          <section className="space-y-4">
            <SectionHeader title="Revenue & cost — last 12 months" />
            {charts.isLoading ? (
              <Card><CardContent className="h-64 p-5"><Skeleton className="h-full w-full" /></CardContent></Card>
            ) : (
              <Card>
                <CardContent className="p-5">
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.08} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis
                        tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={56}
                      />
                      <Tooltip
                        formatter={(v: number, name: string) => [fmtINR(v), name]}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="Revenue" stroke="#6366f1" fill="url(#revGrad)" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="Profit" stroke="#22c55e" fill="url(#profitGrad)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </section>

          {/* Payroll vs Expenses bar chart */}
          <section className="space-y-4">
            <SectionHeader title="Cost breakdown — last 12 months" />
            {charts.isLoading ? (
              <Card><CardContent className="h-64 p-5"><Skeleton className="h-full w-full" /></CardContent></Card>
            ) : (
              <Card>
                <CardContent className="p-5">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }} barSize={14}>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.08} vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis
                        tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={56}
                      />
                      <Tooltip
                        formatter={(v: number, name: string) => [fmtINR(v), name]}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Payroll" fill="#6366f1" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Expenses" fill="#f97316" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </section>

          {/* Team earnings */}
          <section className="space-y-4">
            <div className="flex items-center gap-4">
              <SectionHeader title="Team earnings" />
              <input
                type="month"
                value={earningsMonth}
                onChange={(e) => setEarningsMonth(e.target.value)}
                className="ml-auto rounded border bg-background px-2 py-1 text-sm"
              />
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4" />
                  {earningsMonth} · {teamEarnings.data?.members.length ?? 0} team members
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {teamEarnings.isLoading ? (
                  <div className="space-y-2 p-5">
                    {[1,2,3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
                  </div>
                ) : (teamEarnings.data?.members.length ?? 0) === 0 ? (
                  <p className="p-5 text-sm text-muted-foreground">No payslips for this month.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                          <th className="px-5 py-2">Name</th>
                          <th className="px-5 py-2 text-right">Gross</th>
                          <th className="px-5 py-2 text-right">Deductions</th>
                          <th className="px-5 py-2 text-right">Net Pay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(teamEarnings.data?.members ?? []).map((m) => (
                          <tr key={m.userId} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="px-5 py-2.5 font-medium">{m.name}</td>
                            <td className="px-5 py-2.5 text-right tabular-nums">{formatPaise(m.grossPaise, 'INR')}</td>
                            <td className="px-5 py-2.5 text-right tabular-nums text-destructive">
                              {m.deductionsPaise > 0 ? `−${formatPaise(m.deductionsPaise, 'INR')}` : '—'}
                            </td>
                            <td className="px-5 py-2.5 text-right tabular-nums font-semibold">{formatPaise(m.netPaise, 'INR')}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/20 text-[12px] font-semibold">
                          <td className="px-5 py-2.5">Total</td>
                          <td className="px-5 py-2.5 text-right tabular-nums">
                            {formatPaise((teamEarnings.data?.members ?? []).reduce((s, m) => s + m.grossPaise, 0), 'INR')}
                          </td>
                          <td className="px-5 py-2.5 text-right tabular-nums text-destructive">
                            {(() => {
                              const tot = (teamEarnings.data?.members ?? []).reduce((s, m) => s + m.deductionsPaise, 0);
                              return tot > 0 ? `−${formatPaise(tot, 'INR')}` : '—';
                            })()}
                          </td>
                          <td className="px-5 py-2.5 text-right tabular-nums">
                            {formatPaise((teamEarnings.data?.members ?? []).reduce((s, m) => s + m.netPaise, 0), 'INR')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}

      {/* All roles — personal snapshot */}
      <section className="space-y-4">
        <SectionHeader title="My snapshot" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {member.isLoading ? (
            <StatSkeletons count={3} />
          ) : (
            <>
              <Stat
                title="Open tasks"
                value={(member.data?.openTasks ?? 0).toString()}
                icon={CheckSquare}
              />
              <Stat
                title="Pending leaves"
                value={(member.data?.pendingLeaves ?? 0).toString()}
                icon={Clock}
              />
              <Stat
                title="Last payslip"
                value={
                  member.data?.lastPayslip
                    ? formatPaise(member.data.lastPayslip.netPaise, 'INR')
                    : '—'
                }
                icon={CreditCard}
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {title}
      </h2>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function Stat({
  title,
  value,
  description,
  icon: Icon,
  iconClassName,
}: {
  title: string;
  value: string;
  description?: string;
  icon: React.ElementType;
  iconClassName?: string;
}) {
  return (
    <Card className="group transition-shadow hover:shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
              {title}
            </p>
            <p className="mt-2.5 text-[26px] font-semibold leading-none tabular-nums tracking-tight">
              {value}
            </p>
            {description && (
              <p className="mt-2 text-[11px] text-muted-foreground">{description}</p>
            )}
          </div>
          <div
            className={`shrink-0 rounded-lg bg-primary/10 p-2.5 text-primary ${iconClassName ?? ''}`}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatSkeletons({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-5 space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-28" />
          </CardContent>
        </Card>
      ))}
    </>
  );
}
