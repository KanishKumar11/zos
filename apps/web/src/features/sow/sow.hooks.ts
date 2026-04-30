// SOW hooks (OWNER only).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  MilestoneStatus,
  type CreateSowInput,
  type UpdateSowInput,
} from '@agency/shared';

import { api, unwrap } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

export interface SowMilestoneRow {
  title: string;
  amountPaise: number;
  dueDate?: string;
  status: MilestoneStatus;
}
export interface SowRow {
  _id: string;
  clientId: string;
  projectId?: string;
  title: string;
  description: string;
  totalValuePaise: number;
  currency: string;
  milestones: SowMilestoneRow[];
  documentKey?: string;
  signedAt?: string;
  createdAt: string;
}

export const sowApi = {
  list: (params: { clientId?: string; projectId?: string } = {}) =>
    unwrap<SowRow[]>(api.get('/sows', { params })),
  byId: (id: string) => unwrap<SowRow>(api.get(`/sows/${id}`)),
  create: (body: CreateSowInput) => unwrap<SowRow>(api.post('/sows', body)),
  update: (id: string, body: UpdateSowInput) => unwrap<SowRow>(api.patch(`/sows/${id}`, body)),
  remove: (id: string) => unwrap<{ ok: boolean }>(api.delete(`/sows/${id}`)),
};

export function useSows(params: { clientId?: string; projectId?: string } = {}) {
  return useQuery({
    queryKey: params.projectId ? qk.sows.byProject(params.projectId) : qk.sows.all(),
    queryFn: () => sowApi.list(params),
  });
}
export function useSow(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.sows.byId(id) : ['sows', 'undefined'],
    queryFn: () => sowApi.byId(id!),
    enabled: !!id,
  });
}
export function useCreateSow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSowInput) => sowApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.sows.all() });
      toast.success('SOW created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
export function useUpdateSow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: UpdateSowInput }) => sowApi.update(vars.id, vars.body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.sows.byId(vars.id) });
      qc.invalidateQueries({ queryKey: qk.sows.all() });
    },
  });
}
