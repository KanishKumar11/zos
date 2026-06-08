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
import { Users } from 'lucide-react';
import { Role } from '@agency/shared';

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
  const mo = m.split('-')[1] ?? '';
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
    <div className="space-y-12 pb-12">
      {/* Greeting */}
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Welcome back, {user?.name?.split(' ')[0] ?? 'System'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here's your agency overview and system metrics.
        </p>
      </div>

      {/* Owner — agency overview */}
      {isOwner && (
        <>
          <section className="space-y-6">
            <SectionHeader title="Agency Metrics" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {owner.isLoading ? (
                <StatSkeletons count={4} />
              ) : owner.data ? (
                <>
                  <Stat
                    title="Active projects"
                    value={owner.data.activeProjects.toString()}
                  />
                  <Stat
                    title="Active SOWs"
                    value={owner.data.activeSows.toString()}
                  />
                  <Stat
                    title="Outstanding"
                    value={formatPaise(owner.data.invoices.outstanding, 'INR')}
                    description={`Overdue ${formatPaise(owner.data.invoices.overdue, 'INR')}`}
                    valueClassName="text-warning"
                  />
                  <Stat
                    title="Collected"
                    value={formatPaise(owner.data.invoices.collected, 'INR')}
                    description={
                      owner.data.lastPayrollRun
                        ? `Last payroll · ${owner.data.lastPayrollRun.month}`
                        : 'No payroll runs yet'
                    }
                  />
                </>
              ) : null}
            </div>
          </section>

          {/* Revenue vs Cost chart */}
          <section className="space-y-6">
            <SectionHeader title="Financial Performance" />
            {charts.isLoading ? (
              <div className="h-72 rounded-2xl border border-border/50 p-6 bg-card shadow-sm"><Skeleton className="h-full w-full rounded-xl" /></div>
            ) : (
              <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="currentColor" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="currentColor" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.06} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} dy={10} />
                    <YAxis
                      tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                      width={60}
                      dx={-10}
                    />
                    <Tooltip
                      formatter={(v: number, name: string) => [fmtINR(v), name]}
                      contentStyle={{ fontSize: 13, borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--card)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                      cursor={{ stroke: 'var(--border)', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13, paddingTop: '20px' }} />
                    <Area type="monotone" dataKey="Revenue" stroke="currentColor" fill="url(#colorRev)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: 'currentColor' }} />
                    <Area type="monotone" dataKey="Profit" stroke="#22c55e" fill="url(#colorProf)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: '#22c55e' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* Payroll vs Expenses bar chart */}
          <section className="space-y-6">
            <SectionHeader title="Cost Breakdown" />
            {charts.isLoading ? (
              <div className="h-72 rounded-2xl border border-border/50 p-6 bg-card shadow-sm"><Skeleton className="h-full w-full rounded-xl" /></div>
            ) : (
              <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }} barSize={12} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.06} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} dy={10} />
                    <YAxis
                      tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                      width={60}
                      dx={-10}
                    />
                    <Tooltip
                      formatter={(v: number, name: string) => [fmtINR(v), name]}
                      contentStyle={{ fontSize: 13, borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--card)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                      cursor={{ fill: 'currentColor', opacity: 0.03 }}
                      itemStyle={{ color: 'var(--foreground)' }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13, paddingTop: '20px' }} />
                    <Bar dataKey="Payroll" fill="currentColor" radius={[4, 4, 0, 0]} opacity={0.8} />
                    <Bar dataKey="Expenses" fill="currentColor" radius={[4, 4, 0, 0]} opacity={0.3} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* Team earnings */}
          <section className="space-y-6">
            <div className="flex items-center gap-4">
              <SectionHeader title="Team Payroll" />
              <input
                type="month"
                value={earningsMonth}
                onChange={(e) => setEarningsMonth(e.target.value)}
                className="ml-auto rounded-xl border border-border/50 bg-card px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 p-5 border-b border-border/50 text-sm font-medium text-muted-foreground bg-muted/10">
                <Users className="h-4 w-4" />
                <span>{earningsMonth} &middot; {teamEarnings.data?.members.length ?? 0} Active Members</span>
              </div>
              <div>
                {teamEarnings.isLoading ? (
                  <div className="space-y-2 p-5">
                    {[1,2,3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
                  </div>
                ) : (teamEarnings.data?.members.length ?? 0) === 0 ? (
                  <p className="p-8 text-center text-sm text-muted-foreground">No payslip records found for this month.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/50 text-left font-medium text-muted-foreground bg-muted/5">
                          <th className="px-6 py-4 font-medium">Team Member</th>
                          <th className="px-6 py-4 text-right font-medium">Gross Pay</th>
                          <th className="px-6 py-4 text-right font-medium">Deductions</th>
                          <th className="px-6 py-4 text-right font-medium">Net Deposit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {(teamEarnings.data?.members ?? []).map((m) => (
                          <tr key={m.userId} className="hover:bg-muted/10 transition-colors">
                            <td className="px-6 py-4 font-medium text-foreground">{m.name}</td>
                            <td className="px-6 py-4 text-right">{formatPaise(m.grossPaise, 'INR')}</td>
                            <td className="px-6 py-4 text-right text-destructive">
                              {m.deductionsPaise > 0 ? `−${formatPaise(m.deductionsPaise, 'INR')}` : '—'}
                            </td>
                            <td className="px-6 py-4 text-right font-semibold text-foreground">{formatPaise(m.netPaise, 'INR')}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/20 text-foreground font-semibold">
                          <td className="px-6 py-5 rounded-bl-xl">Total Aggregated</td>
                          <td className="px-6 py-5 text-right">
                            {formatPaise((teamEarnings.data?.members ?? []).reduce((s, m) => s + m.grossPaise, 0), 'INR')}
                          </td>
                          <td className="px-6 py-5 text-right text-destructive">
                            {(() => {
                              const tot = (teamEarnings.data?.members ?? []).reduce((s, m) => s + m.deductionsPaise, 0);
                              return tot > 0 ? `−${formatPaise(tot, 'INR')}` : '—';
                            })()}
                          </td>
                          <td className="px-6 py-5 text-right rounded-br-xl">
                            {formatPaise((teamEarnings.data?.members ?? []).reduce((s, m) => s + m.netPaise, 0), 'INR')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {/* All roles — personal snapshot */}
      <section className="space-y-6">
        <SectionHeader title="Personal Snapshot" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {member.isLoading ? (
            <StatSkeletons count={3} />
          ) : (
            <>
              <Stat
                title="Active assignments"
                value={(member.data?.openTasks ?? 0).toString()}
              />
              <Stat
                title="Pending time-off"
                value={(member.data?.pendingLeaves ?? 0).toString()}
              />
              <Stat
                title="Latest deposit"
                value={
                  member.data?.lastPayslip
                    ? formatPaise(member.data.lastPayslip.netPaise, 'INR')
                    : '—'
                }
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
    <div className="flex items-center gap-4">
      <h2 className="text-sm font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="h-px flex-1 bg-border/50" />
    </div>
  );
}

function Stat({
  title,
  value,
  description,
  valueClassName,
}: {
  title: string;
  value: string;
  description?: string;
  valueClassName?: string;
}) {
  return (
    <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-border/50 bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />
      <p className="text-sm font-medium text-muted-foreground relative z-10">
        {title}
      </p>
      <div className="relative z-10 mt-6">
        <p className={`text-3xl sm:text-4xl font-semibold tracking-tight ${valueClassName ?? 'text-foreground'}`}>
          {value}
        </p>
        {description && (
          <p className="mt-2 text-xs font-medium text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}

function StatSkeletons({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col justify-between rounded-2xl border border-border/50 bg-card p-6 shadow-sm space-y-4">
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-10 w-28 rounded-md mt-6" />
        </div>
      ))}
    </>
  );
}
