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
  Clock,
  CreditCard,
  IndianRupee,
  Users,
} from 'lucide-react';
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
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight uppercase">
          AGENCY TERMINAL // {user?.name?.split(' ')[0] ?? 'SYSTEM'}
        </h1>
        <p className="text-sm font-mono tracking-tight text-muted-foreground uppercase">
          OVERVIEW AND SYSTEM METRICS
        </p>
      </div>

      {/* Owner — agency overview */}
      {isOwner && (
        <>
          <section className="space-y-4">
            <SectionHeader title="AGENCY METRICS" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border">
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
          <section className="space-y-4">
            <SectionHeader title="FINANCIAL PERFORMANCE // LAST 12M" />
            {charts.isLoading ? (
              <div className="h-64 border border-border p-5 bg-background"><Skeleton className="h-full w-full rounded-none" /></div>
            ) : (
              <div className="border border-border bg-background p-6">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
                    <YAxis
                      tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11, fontFamily: 'monospace' }}
                      tickLine={false}
                      axisLine={false}
                      width={60}
                    />
                    <Tooltip
                      formatter={(v: number, name: string) => [fmtINR(v), name]}
                      contentStyle={{ fontSize: 12, borderRadius: 0, border: '1px solid var(--border)', background: 'var(--background)' }}
                    />
                    <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 12, fontFamily: 'monospace' }} />
                    <Area type="step" dataKey="Revenue" stroke="currentColor" fill="currentColor" fillOpacity={0.05} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                    <Area type="step" dataKey="Profit" stroke="#22c55e" fill="#22c55e" fillOpacity={0.05} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* Payroll vs Expenses bar chart */}
          <section className="space-y-4">
            <SectionHeader title="COST BREAKDOWN // LAST 12M" />
            {charts.isLoading ? (
              <div className="h-64 border border-border p-5 bg-background"><Skeleton className="h-full w-full rounded-none" /></div>
            ) : (
              <div className="border border-border bg-background p-6">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }} barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
                    <YAxis
                      tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11, fontFamily: 'monospace' }}
                      tickLine={false}
                      axisLine={false}
                      width={60}
                    />
                    <Tooltip
                      formatter={(v: number, name: string) => [fmtINR(v), name]}
                      contentStyle={{ fontSize: 12, borderRadius: 0, border: '1px solid var(--border)', background: 'var(--background)' }}
                      cursor={{ fill: 'currentColor', opacity: 0.05 }}
                    />
                    <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 12, fontFamily: 'monospace' }} />
                    <Bar dataKey="Payroll" fill="currentColor" opacity={0.8} />
                    <Bar dataKey="Expenses" fill="currentColor" opacity={0.3} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* Team earnings */}
          <section className="space-y-4">
            <div className="flex items-center gap-4">
              <SectionHeader title="TEAM PAYROLL // DATA LOG" />
              <input
                type="month"
                value={earningsMonth}
                onChange={(e) => setEarningsMonth(e.target.value)}
                className="ml-auto rounded-none border border-border bg-background px-3 py-1.5 text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="border border-border bg-background">
              <div className="flex items-center gap-2 p-4 border-b border-border text-xs font-mono uppercase tracking-widest text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span>{earningsMonth} // {teamEarnings.data?.members.length ?? 0} ACTIVE MEMBERS</span>
              </div>
              <div>
                {teamEarnings.isLoading ? (
                  <div className="space-y-px bg-border p-4">
                    {[1,2,3].map((i) => <Skeleton key={i} className="h-8 w-full rounded-none bg-background" />)}
                  </div>
                ) : (teamEarnings.data?.members.length ?? 0) === 0 ? (
                  <p className="p-6 text-sm font-mono text-muted-foreground uppercase">NO PAYSLIP RECORDS FOUND.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm font-mono">
                      <thead>
                        <tr className="border-b border-border text-left text-[10px] uppercase tracking-widest text-muted-foreground bg-muted/20">
                          <th className="px-6 py-3">Identifier</th>
                          <th className="px-6 py-3 text-right">Gross Pay</th>
                          <th className="px-6 py-3 text-right">Deductions</th>
                          <th className="px-6 py-3 text-right">Net Deposit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(teamEarnings.data?.members ?? []).map((m) => (
                          <tr key={m.userId} className="hover:bg-muted/30 transition-colors">
                            <td className="px-6 py-3.5 font-medium">{m.name}</td>
                            <td className="px-6 py-3.5 text-right">{formatPaise(m.grossPaise, 'INR')}</td>
                            <td className="px-6 py-3.5 text-right text-destructive">
                              {m.deductionsPaise > 0 ? `−${formatPaise(m.deductionsPaise, 'INR')}` : '—'}
                            </td>
                            <td className="px-6 py-3.5 text-right font-bold">{formatPaise(m.netPaise, 'INR')}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-widest">
                          <td className="px-6 py-4">Total Aggregated</td>
                          <td className="px-6 py-4 text-right">
                            {formatPaise((teamEarnings.data?.members ?? []).reduce((s, m) => s + m.grossPaise, 0), 'INR')}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {(() => {
                              const tot = (teamEarnings.data?.members ?? []).reduce((s, m) => s + m.deductionsPaise, 0);
                              return tot > 0 ? `−${formatPaise(tot, 'INR')}` : '—';
                            })()}
                          </td>
                          <td className="px-6 py-4 text-right">
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
      <section className="space-y-4">
        <SectionHeader title="PERSONAL SNAPSHOT // LOCAL" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border border border-border">
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
      <h2 className="text-[11px] font-mono font-bold uppercase tracking-[0.1em] text-foreground">
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
  valueClassName,
}: {
  title: string;
  value: string;
  description?: string;
  valueClassName?: string;
}) {
  return (
    <div className="bg-background p-6 flex flex-col justify-between h-full group">
      <p className="text-[10px] font-mono font-bold uppercase tracking-[0.1em] text-muted-foreground mb-4">
        {title}
      </p>
      <div>
        <p className={`text-4xl font-bold tracking-tighter ${valueClassName ?? ''}`}>
          {value}
        </p>
        {description && (
          <p className="mt-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}

function StatSkeletons({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-background p-6 space-y-4">
          <Skeleton className="h-3 w-24 rounded-none" />
          <Skeleton className="h-10 w-28 rounded-none" />
        </div>
      ))}
    </>
  );
}

