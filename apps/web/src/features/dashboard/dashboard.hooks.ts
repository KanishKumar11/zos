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
  expensesThisMonth: number;
  expensesNextMonth: number;
  profitThisMonth: number;
  profitThisFinancialYear: number;
  fyLabel: string;
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

export const dashboardApi = {
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
