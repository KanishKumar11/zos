// SOW hooks (OWNER only).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  MilestoneStatus,
  type CreateSowInput,
  type SowBriefInput,
  type SowDocumentInput,
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
export interface SowBriefRow {
  scopeSummary: string;
  deliverables: string[];
  timelineStart?: string;
  timelineEnd?: string;
  revisionRounds?: number;
  publishedAt?: string;
  publishedBy?: string;
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
  documentContentType?: string;
  signedAt?: string;
  brief?: SowBriefRow;
  createdAt: string;
}

export const sowApi = {
  list: (params: { clientId?: string; projectId?: string } = {}) =>
    unwrap<SowRow[]>(api.get('/sows', { params })),
  byId: (id: string) => unwrap<SowRow>(api.get(`/sows/${id}`)),
  create: (body: CreateSowInput) => unwrap<SowRow>(api.post('/sows', body)),
  update: (id: string, body: UpdateSowInput) => unwrap<SowRow>(api.patch(`/sows/${id}`, body)),
  remove: (id: string) => unwrap<{ ok: boolean }>(api.delete(`/sows/${id}`)),
  brief: (id: string) => unwrap<SowBriefRow>(api.get(`/sows/${id}/brief`)),
  publishBrief: (id: string, body: SowBriefInput) =>
    unwrap<SowRow>(api.post(`/sows/${id}/brief`, body)),
  setDocument: (id: string, body: SowDocumentInput) =>
    unwrap<SowRow>(api.post(`/sows/${id}/document`, body)),
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

export function usePublishSowBrief() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: SowBriefInput }) =>
      sowApi.publishBrief(vars.id, vars.body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.sows.byId(vars.id) });
      toast.success('Brief published');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
export function useSetSowDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: SowDocumentInput }) =>
      sowApi.setDocument(vars.id, vars.body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.sows.byId(vars.id) });
      toast.success('Document attached');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
