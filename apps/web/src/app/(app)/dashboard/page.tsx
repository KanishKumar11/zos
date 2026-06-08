'use client';

import { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
} from 'recharts';
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

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const isOwner = role === Role.OWNER;
  const owner = useOwnerDashboard(isOwner);
  const member = useMemberDashboard();
  const charts = useOwnerCharts(isOwner);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [earningsMonth, setEarningsMonth] = useState(currentMonth);
  const teamEarnings = useTeamEarnings(earningsMonth, isOwner);

  const chartData = (charts.data?.revenueByMonth ?? []).map((r, i) => ({
    month: shortMonth(r.month),
    Revenue: Math.round(toINR(r.collectedPaise)),
    Payroll: Math.round(toINR(charts.data?.payrollByMonth[i]?.totalNetPaise ?? 0)),
    Expenses: Math.round(toINR((charts.data?.expensesByMonth[i]?.totalPaise ?? 0) + (charts.data?.freelancerByMonth[i]?.totalPaise ?? 0))),
    Profit: Math.round(toINR(charts.data?.profitByMonth[i]?.profitPaise ?? 0)),
  }));

  return (
    <div className="max-w-[1600px] mx-auto pb-24">
      {/* Header */}
      <header className="border-b border-border py-8 md:py-16 mb-8 md:mb-16 px-4 md:px-0">
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
          <h1 className="text-5xl md:text-7xl font-medium tracking-tighter uppercase">
            Agency<br />Ledger
          </h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
            Operator // {user?.name?.split(' ')[0] ?? 'System'}
          </p>
        </div>
      </header>

      {isOwner && (
        <div className="border-t border-border">
          {/* Top Section: Primary Metric + Sparkline vs Secondary Stack */}
          <div className="grid grid-cols-1 lg:grid-cols-12 border-b border-border">
            {/* Primary Left */}
            <div className="lg:col-span-8 lg:border-r border-border p-6 md:p-12 flex flex-col">
              <p className="text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground mb-6">Collected YTD</p>
              <div className="text-6xl md:text-8xl lg:text-[10rem] leading-none font-medium tracking-tighter mb-12 lg:mb-24">
                {owner.isLoading ? <Skeleton className="h-24 w-1/2 rounded-none" /> : formatPaise(owner.data?.invoices.collected ?? 0, 'INR')}
              </div>
              
              <div className="h-32 md:h-48 w-full mt-auto">
                {charts.isLoading ? (
                  <Skeleton className="h-full w-full rounded-none" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <Area 
                        type="monotone" 
                        dataKey="Revenue" 
                        stroke="var(--foreground)" 
                        strokeWidth={1.5} 
                        fill="none" 
                        isAnimationActive={false} 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Secondary Right */}
            <div className="lg:col-span-4 flex flex-col">
              <StatBlock 
                title="Active Projects" 
                value={owner.isLoading ? '—' : owner.data?.activeProjects.toString() ?? '0'} 
              />
              <StatBlock 
                title="Active SOWs" 
                value={owner.isLoading ? '—' : owner.data?.activeSows.toString() ?? '0'} 
              />
              <StatBlock 
                title="Outstanding" 
                value={owner.isLoading ? '—' : formatPaise(owner.data?.invoices.outstanding ?? 0, 'INR')} 
                className="border-b-0 flex-1" 
                valueClassName="text-destructive"
              />
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 border-b border-border">
            <div className="lg:col-span-4 lg:border-r border-border border-b lg:border-b-0 p-6 md:p-12 flex flex-col justify-between">
              <p className="text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground mb-6">Cost Breakdown</p>
              <div className="text-4xl md:text-6xl font-medium tracking-tighter">
                Payroll &<br />Expenses
              </div>
            </div>
            <div className="lg:col-span-8 p-6 md:p-12">
              <div className="h-48 md:h-64 w-full">
                {charts.isLoading ? (
                  <Skeleton className="h-full w-full rounded-none" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barSize={8} barGap={4}>
                      <Bar dataKey="Payroll" fill="var(--foreground)" />
                      <Bar dataKey="Expenses" fill="var(--muted-foreground)" opacity={0.3} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Team Payroll Ledger */}
          <div className="p-6 md:p-12 border-b border-border">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground mb-2">Ledger</p>
                <h2 className="text-4xl md:text-6xl font-medium tracking-tighter">Team Payroll</h2>
              </div>
              <input
                type="month"
                value={earningsMonth}
                onChange={(e) => setEarningsMonth(e.target.value)}
                className="bg-transparent border-b border-foreground rounded-none px-0 py-2 text-xl md:text-3xl font-medium tracking-tight focus:outline-none focus:border-foreground w-48"
              />
            </div>

            <div>
              {teamEarnings.isLoading ? (
                <div className="space-y-4">
                  {[1,2,3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-none" />)}
                </div>
              ) : (teamEarnings.data?.members.length ?? 0) === 0 ? (
                <p className="py-12 text-center text-sm font-mono uppercase tracking-[0.2em] text-muted-foreground">No ledger entries.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-foreground text-left text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground">
                        <th className="pb-4 font-normal">Team Member</th>
                        <th className="pb-4 text-right font-normal">Gross Pay</th>
                        <th className="pb-4 text-right font-normal">Deductions</th>
                        <th className="pb-4 text-right font-normal">Net Deposit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(teamEarnings.data?.members ?? []).map((m) => (
                        <tr key={m.userId} className="group hover:bg-muted/10 transition-colors">
                          <td className="py-6 text-xl md:text-2xl font-medium tracking-tight text-foreground">{m.name}</td>
                          <td className="py-6 text-xl md:text-2xl text-right font-medium text-muted-foreground">{formatPaise(m.grossPaise, 'INR')}</td>
                          <td className="py-6 text-xl md:text-2xl text-right font-medium text-destructive">
                            {m.deductionsPaise > 0 ? `−${formatPaise(m.deductionsPaise, 'INR')}` : '—'}
                          </td>
                          <td className="py-6 text-xl md:text-2xl text-right font-medium text-foreground">{formatPaise(m.netPaise, 'INR')}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-foreground text-foreground">
                        <td className="py-8 text-xl md:text-2xl font-medium tracking-tight">Total Aggregated</td>
                        <td className="py-8 text-xl md:text-2xl text-right font-medium text-muted-foreground">
                          {formatPaise((teamEarnings.data?.members ?? []).reduce((s, m) => s + m.grossPaise, 0), 'INR')}
                        </td>
                        <td className="py-8 text-xl md:text-2xl text-right font-medium text-destructive">
                          {(() => {
                            const tot = (teamEarnings.data?.members ?? []).reduce((s, m) => s + m.deductionsPaise, 0);
                            return tot > 0 ? `−${formatPaise(tot, 'INR')}` : '—';
                          })()}
                        </td>
                        <td className="py-8 text-xl md:text-2xl text-right font-medium text-foreground">
                          {formatPaise((teamEarnings.data?.members ?? []).reduce((s, m) => s + m.netPaise, 0), 'INR')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Personal Snapshot */}
      <div className="mt-16 md:mt-32 px-4 md:px-0">
        <p className="text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground mb-8">Personal Snapshot</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-t border-b border-border divide-y md:divide-y-0 md:divide-x divide-border">
          <StatBlock 
            title="Active Assignments" 
            value={member.isLoading ? '—' : (member.data?.openTasks ?? 0).toString()} 
            className="border-b-0"
          />
          <StatBlock 
            title="Pending Time-off" 
            value={member.isLoading ? '—' : (member.data?.pendingLeaves ?? 0).toString()} 
            className="border-b-0"
          />
          <StatBlock 
            title="Latest Deposit" 
            value={member.isLoading ? '—' : (member.data?.lastPayslip ? formatPaise(member.data.lastPayslip.netPaise, 'INR') : '—')} 
            className="border-b-0"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatBlock({
  title,
  value,
  className = '',
  valueClassName = '',
}: {
  title: string;
  value: string;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={`p-6 md:p-12 border-b border-border flex flex-col justify-center ${className}`}>
      <p className="text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground mb-6">
        {title}
      </p>
      <p className={`text-4xl md:text-6xl lg:text-7xl font-medium tracking-tighter ${valueClassName || 'text-foreground'}`}>
        {value}
      </p>
    </div>
  );
}
