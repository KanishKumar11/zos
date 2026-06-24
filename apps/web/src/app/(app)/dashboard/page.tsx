'use client';

import { useState } from 'react';
import {
  Bar,
  BarChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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
import { BillingReminders } from './billing-reminders';
import { DashboardNotifications } from './dashboard-notifications';

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
    <div className="max-w-[1400px] mx-auto pb-16">
      {/* Header */}
      <header className="border-b border-border py-6 md:py-10 mb-6 md:mb-10 px-4 md:px-0">
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
            Agency Ledger
          </h1>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-mono">
            Operator // {user?.name?.split(' ')[0] ?? 'System'}
          </p>
        </div>
      </header>

      {isOwner && <DashboardNotifications />}
      {isOwner && <BillingReminders />}

      {isOwner && (
        <div className="border-t border-border">
          {/* Revenue row: this month / this FY / collected all time / outstanding */}
          <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-border divide-x divide-border">
            <StatBlock
              title={`Revenue — ${new Date().toLocaleString('en-IN', { month: 'short' })} ${new Date().getFullYear()}`}
              value={owner.isLoading ? '—' : formatPaise(owner.data?.revenueThisMonth ?? 0, 'INR')}
            />
            <StatBlock
              title={owner.data?.fyLabel ?? 'This Financial Year'}
              value={owner.isLoading ? '—' : formatPaise(owner.data?.revenueThisFinancialYear ?? 0, 'INR')}
            />
            <StatBlock
              title="Profit This Month"
              value={owner.isLoading ? '—' : formatPaise(owner.data?.profitThisMonth ?? 0, 'INR')}
              valueClassName={(owner.data?.profitThisMonth ?? 0) >= 0 ? 'text-emerald-600' : 'text-destructive'}
            />
            <StatBlock
              title="Profit This FY"
              value={owner.isLoading ? '—' : formatPaise(owner.data?.profitThisFinancialYear ?? 0, 'INR')}
              valueClassName={(owner.data?.profitThisFinancialYear ?? 0) >= 0 ? 'text-emerald-600' : 'text-destructive'}
            />
          </div>

          {/* Top Section: Primary Metric + Chart vs Secondary Stack */}
          <div className="grid grid-cols-1 lg:grid-cols-12 border-b border-border">
            {/* Primary Left */}
            <div className="lg:col-span-8 lg:border-r border-border p-6 md:p-8 flex flex-col">
              <p className="text-xs uppercase tracking-wider font-mono text-muted-foreground mb-4">All-Time Collected</p>
              <div className="text-4xl md:text-5xl lg:text-6xl leading-none font-semibold tracking-tight mb-8">
                {owner.isLoading ? <Skeleton className="h-16 w-1/2 rounded-md" /> : formatPaise(owner.data?.invoices.collected ?? 0, 'INR')}
              </div>

              {/* Revenue + Profit dual-line chart */}
              <div className="h-56 md:h-72 w-full mt-auto">
                {charts.isLoading ? (
                  <Skeleton className="h-full w-full rounded-md" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                        formatter={(v: number) => [`₹${Math.round(v / 100).toLocaleString('en-IN')}`, '']}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      <Line type="monotone" dataKey="Revenue" stroke="var(--foreground)" strokeWidth={2} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="Profit" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} strokeDasharray="4 4" />
                    </LineChart>
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
                title={`Expenses — ${new Date().toLocaleString('en-IN', { month: 'short' })} ${new Date().getFullYear()}`}
                value={owner.isLoading ? '—' : formatPaise(owner.data?.expensesThisMonth ?? 0, 'INR')}
              />
              <StatBlock
                title={`Expenses — ${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleString('en-IN', { month: 'short' })} ${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).getFullYear()}`}
                value={owner.isLoading ? '—' : formatPaise(owner.data?.expensesNextMonth ?? 0, 'INR')}
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
            <div className="lg:col-span-4 lg:border-r border-border border-b lg:border-b-0 p-6 md:p-8 flex flex-col justify-between">
              <p className="text-xs uppercase tracking-wider font-mono text-muted-foreground mb-4">Cost Breakdown</p>
              <div className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
                Payroll &<br />Expenses
              </div>
            </div>
            <div className="lg:col-span-8 p-6 md:p-8">
              <div className="h-56 md:h-72 w-full">
                {charts.isLoading ? (
                  <Skeleton className="h-full w-full rounded-md" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barSize={12} barGap={4}>
                      <Tooltip
                        contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                        formatter={(v: number) => [`₹${Math.round(v / 100).toLocaleString('en-IN')}`, '']}
                      />
                      <Bar dataKey="Payroll" fill="var(--foreground)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Expenses" fill="var(--muted-foreground)" opacity={0.4} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Team Payroll Ledger */}
          <div className="p-6 md:p-8 border-b border-border">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider font-mono text-muted-foreground mb-2">Ledger</p>
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">Team Payroll</h2>
              </div>
              <input
                type="month"
                value={earningsMonth}
                onChange={(e) => setEarningsMonth(e.target.value)}
                className="bg-transparent border-b border-border rounded-none px-0 py-1 text-base md:text-lg font-medium tracking-tight focus:outline-none focus:border-foreground w-40 text-foreground transition-colors"
              />
            </div>

            <div>
              {teamEarnings.isLoading ? (
                <div className="space-y-4">
                  {[1,2,3].map((i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}
                </div>
              ) : (teamEarnings.data?.members.length ?? 0) === 0 ? (
                <p className="py-12 text-center text-sm font-mono uppercase tracking-widest text-muted-foreground">No ledger entries.</p>
              ) : (
                <div className="overflow-x-auto -mx-4 md:-mx-8 px-4 md:px-8">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr>
                        <th className="pb-3 pt-2 font-medium text-muted-foreground text-xs uppercase tracking-wider border-b border-border whitespace-nowrap">Team Member</th>
                        <th className="pb-3 pt-2 font-medium text-muted-foreground text-xs uppercase tracking-wider border-b border-border whitespace-nowrap text-right">Gross Pay</th>
                        <th className="pb-3 pt-2 font-medium text-muted-foreground text-xs uppercase tracking-wider border-b border-border whitespace-nowrap text-right">Deductions</th>
                        <th className="pb-3 pt-2 font-medium text-muted-foreground text-xs uppercase tracking-wider border-b border-border whitespace-nowrap text-right">Net Deposit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(teamEarnings.data?.members ?? []).map((m) => (
                        <tr key={m.userId} className="group hover:bg-muted/30 transition-colors">
                          <td className="py-4 text-sm font-medium text-foreground border-b border-border align-middle">{m.name}</td>
                          <td className="py-4 text-sm text-foreground border-b border-border align-middle text-right">{formatPaise(m.grossPaise, 'INR')}</td>
                          <td className="py-4 text-sm text-destructive border-b border-border align-middle text-right">
                            {m.deductionsPaise > 0 ? `−${formatPaise(m.deductionsPaise, 'INR')}` : '—'}
                          </td>
                          <td className="py-4 text-sm font-semibold text-foreground border-b border-border align-middle text-right">{formatPaise(m.netPaise, 'INR')}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className="py-4 text-sm font-medium text-foreground border-b-0 align-middle">Total Aggregated</td>
                        <td className="py-4 text-sm text-muted-foreground border-b-0 align-middle text-right">
                          {formatPaise((teamEarnings.data?.members ?? []).reduce((s, m) => s + m.grossPaise, 0), 'INR')}
                        </td>
                        <td className="py-4 text-sm text-destructive border-b-0 align-middle text-right">
                          {(() => {
                            const tot = (teamEarnings.data?.members ?? []).reduce((s, m) => s + m.deductionsPaise, 0);
                            return tot > 0 ? `−${formatPaise(tot, 'INR')}` : '—';
                          })()}
                        </td>
                        <td className="py-4 text-sm font-semibold text-foreground border-b-0 align-middle text-right">
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
      <div className="mt-12 md:mt-16 px-4 md:px-0">
        <p className="text-xs uppercase tracking-wider font-mono text-muted-foreground mb-6">Personal Snapshot</p>
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
    <div className={`p-5 md:p-6 border-b border-border flex flex-col justify-center ${className}`}>
      <p className="text-xs uppercase tracking-wider font-mono text-muted-foreground mb-2">
        {title}
      </p>
      <p className={`text-2xl md:text-3xl font-semibold tracking-tight ${valueClassName || 'text-foreground'}`}>
        {value}
      </p>
    </div>
  );
}
