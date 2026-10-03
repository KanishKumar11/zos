// Dashboard hooks.
import { useQuery } from '@tanstack/react-query';

import { api, unwrap } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

export interface OwnerDashboard {
  activeProjects: number;
  activeSows: number;
  invoices: {
    outstanding: number;
    overdue: number;
    collected: number;
    byStatus: Record<string, { total: number; paid: number; count: number }>;
  };
  lastPayrollRun: { month: string; totalNetPaise: number; memberCount: number } | null;
  revenueThisMonth: number;
  revenueThisFinancialYear: number;
  otherIncomeThisMonth: number;
  otherIncomeThisFinancialYear: number;
  expensesThisMonth: number;
  expensesNextMonth: number;
  profitThisMonth: number;
  profitThisFinancialYear: number;
  fyLabel: string;
  costBreakdownThisMonth?: CostBreakdown;
  costBreakdownThisFinancialYear?: CostBreakdown;
}

export interface CostBreakdown {
  payrollPaise: number;
  expensesPaise: number;
  teamPayoutsPaise: number;
  freelancerPayoutsPaise: number;
}

export interface BirthdayNotification {
  userId: string;
  name: string;
  daysUntil: number;
  dateLabel: string;
}

export interface DashboardNotifications {
  birthdays: BirthdayNotification[];
  payrollReminder: { month: string } | null;
}

export interface MemberEarningPoint {
  month: string;
  grossPaise: number;
  netPaise: number;
  deductionsPaise: number;
}

export interface MemberProjectStat {
  projectId: string;
  projectName: string;
  projectCode: string;
  status: string;
  role?: string;
  amountPaise: number;
  payments: { paidAt: string; amountPaise: number; note?: string }[];
}

export interface MemberStats {
  earnings: MemberEarningPoint[];
  projects: MemberProjectStat[];
}

export interface MemberDashboard {
  openTasks: number;
  pendingLeaves: number;
  lastPayslip: { netPaise: number; runId: string } | null;
}

export interface MonthPoint {
  month: string; // YYYY-MM
}
export interface RevenuePoint extends MonthPoint { collectedPaise: number }
export interface PayrollPoint extends MonthPoint { totalNetPaise: number; memberCount: number }
export interface ExpensePoint extends MonthPoint { totalPaise: number }
export interface ProfitPoint extends MonthPoint { profitPaise: number }

export interface OwnerCharts {
  revenueByMonth: RevenuePoint[];
  payrollByMonth: PayrollPoint[];
  expensesByMonth: ExpensePoint[];
  freelancerByMonth: ExpensePoint[];
  teamPayoutsByMonth?: ExpensePoint[];
  incomeByMonth?: ExpensePoint[];
  profitByMonth: ProfitPoint[];
}

export interface TeamMemberEarning {
  userId: string;
  name: string;
  month: string;
  grossPaise: number;
  deductionsPaise: number;
  netPaise: number;
}

export interface TeamEarnings {
  month: string;
  members: TeamMemberEarning[];
}

// ── Command centre (OWNER only — GET /dashboard/owner/cockpit) ──
export interface CockpitFlowNode {
  key: string;
  label: string;
  paise: number;
}
export interface CockpitFlow {
  label: string;
  /** Biggest clients, "N more clients", "Other income", and "From reserves" when more went out than came in. */
  inflows: CockpitFlowNode[];
  outflows: { teamPaise: number; freelancerPaise: number; payrollPaise: number; expensesPaise: number };
  revenuePaise: number;
  otherIncomePaise: number;
  inPaise: number;
  outPaise: number;
  /** In − out; negative when the period ran at a loss. */
  keptPaise: number;
  clientCount: number;
}
export type AgingKey = 'current' | '1-30' | '31-60' | '60plus';
export interface CockpitAging {
  buckets: { key: AgingKey; label: string; paise: number; count: number }[];
  outstandingPaise: number;
  overduePaise: number;
  openCount: number;
  overdueCount: number;
  overdueClients: number;
  owingClients: number;
}
export interface CockpitCashDay {
  date: string; // yyyy-mm-dd (India)
  inPaise: number;
  outPaise: number;
}
export interface CockpitProject {
  projectId: string;
  name: string;
  code: string;
  status: string;
  clientId: string | null;
  clientName: string | null;
  startDate: string | null;
  endDate: string | null;
  currency: string;
  budgetPaise: number;
  invoicedPaise: number;
  collectedPaise: number;
  agreedPaise: number;
  paidOutPaise: number;
}
export interface OwnerCockpit {
  month: CockpitFlow;
  fy: CockpitFlow;
  aging: CockpitAging;
  cash: CockpitCashDay[];
  projects: CockpitProject[];
}

export const dashboardApi = {
  cockpit: () => unwrap<OwnerCockpit>(api.get('/dashboard/owner/cockpit')),
  owner: () => unwrap<OwnerDashboard>(api.get('/dashboard/owner')),
  member: () => unwrap<MemberDashboard>(api.get('/dashboard/me')),
  charts: () => unwrap<OwnerCharts>(api.get('/dashboard/owner/charts')),
  teamEarnings: (month?: string) =>
    unwrap<TeamEarnings>(api.get('/dashboard/owner/team-earnings', { params: month ? { month } : {} })),
  notifications: () => unwrap<DashboardNotifications>(api.get('/dashboard/owner/notifications')),
  memberStats: (id: string) => unwrap<MemberStats>(api.get(`/dashboard/owner/member/${id}/stats`)),
};

export function useOwnerDashboard(enabled: boolean) {
  return useQuery({ queryKey: qk.dashboard.owner(), queryFn: dashboardApi.owner, enabled });
}
export function useMemberDashboard() {
  return useQuery({ queryKey: qk.dashboard.member(), queryFn: dashboardApi.member });
}
export function useOwnerCharts(enabled: boolean) {
  return useQuery({
    queryKey: [...qk.dashboard.owner(), 'charts'],
    queryFn: dashboardApi.charts,
    enabled,
  });
}
/** Money flow, aging, daily cash and project health for the owner command centre. */
export function useOwnerCockpit(enabled: boolean) {
  return useQuery({
    queryKey: [...qk.dashboard.owner(), 'cockpit'],
    queryFn: dashboardApi.cockpit,
    enabled,
  });
}
export function useTeamEarnings(month: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...qk.dashboard.owner(), 'team-earnings', month ?? 'current'],
    queryFn: () => dashboardApi.teamEarnings(month),
    enabled,
  });
}
export function useDashboardNotifications(enabled: boolean) {
  return useQuery({
    queryKey: [...qk.dashboard.owner(), 'notifications'],
    queryFn: dashboardApi.notifications,
    enabled,
    refetchInterval: 60 * 60 * 1000, // refresh hourly
  });
}
export function useMemberStats(id: string, enabled: boolean) {
  return useQuery({
    queryKey: [...qk.dashboard.owner(), 'member-stats', id],
    queryFn: () => dashboardApi.memberStats(id),
    enabled,
  });
}
