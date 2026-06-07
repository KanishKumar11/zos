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
