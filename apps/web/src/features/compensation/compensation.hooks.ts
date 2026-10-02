// Compensation API client and React Query hooks (OWNER-only routes).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { CompensationType, UpsertCompensationInput } from '@agency/shared';

import { api, unwrap } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

export interface CompensationProfileRow {
  _id: string;
  userId: string;
  type: CompensationType;
  baseAmount: number;
  currency: string;
  hra: number;
  specialAllowance: number;
  providentFundEmployee: number;
  providentFundEmployer: number;
  professionalTax: number;
  tdsMonthly: number;
  effectiveFrom: string;
  notes?: string;
}
export interface CompensationHistoryRow extends CompensationProfileRow {
  changedBy: string;
  reason?: string;
  createdAt: string;
}

const compensationApi = {
  byUser: (userId: string) =>
    unwrap<CompensationProfileRow | null>(api.get(`/compensation/users/${userId}`)),
  history: (userId: string) =>
    unwrap<CompensationHistoryRow[]>(api.get(`/compensation/users/${userId}/history`)),
  upsert: (userId: string, body: UpsertCompensationInput) =>
    unwrap<CompensationProfileRow | null>(api.put(`/compensation/users/${userId}`, body)),
};

export function useCompensation(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? qk.compensation.byUser(userId) : ['compensation', 'undefined'],
    queryFn: async () => (await compensationApi.byUser(userId!)) ?? null,
    enabled: !!userId,
  });
}

export function useCompensationHistory(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? ['compensation', userId, 'history'] : ['compensation', 'history', 'undefined'],
    queryFn: () => compensationApi.history(userId!),
    enabled: !!userId,
  });
}

/** Save (or schedule) a package. Errors are left to the form. */
export function useUpsertCompensation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userId: string; body: UpsertCompensationInput; scheduled?: boolean }) =>
      compensationApi.upsert(vars.userId, vars.body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.compensation.byUser(vars.userId) });
      qc.invalidateQueries({ queryKey: ['compensation', vars.userId, 'history'] });
      qc.invalidateQueries({ queryKey: ['payroll'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(vars.scheduled ? 'Change scheduled' : 'Package saved', {
        description: 'Recompute any draft payroll run to use the new amounts.',
      });
    },
  });
}
