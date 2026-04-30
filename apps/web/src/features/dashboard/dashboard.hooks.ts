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
  lastPayrollRun: { month: string; totalNetPaise: number; employeeCount: number } | null;
}

export interface MemberDashboard {
  openTasks: number;
  pendingLeaves: number;
  lastPayslip: { netPaise: number; runId: string } | null;
}

export const dashboardApi = {
  owner: () => unwrap<OwnerDashboard>(api.get('/dashboard/owner')),
  member: () => unwrap<MemberDashboard>(api.get('/dashboard/me')),
};

export function useOwnerDashboard(enabled: boolean) {
  return useQuery({ queryKey: qk.dashboard.owner(), queryFn: dashboardApi.owner, enabled });
}
export function useMemberDashboard() {
  return useQuery({ queryKey: qk.dashboard.member(), queryFn: dashboardApi.member });
}
