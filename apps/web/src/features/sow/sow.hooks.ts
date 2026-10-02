// SOW hooks (OWNER only).
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  MilestoneStatus,
  type CreateProjectFromSowInput,
  type SowBriefInput,
  type SowDocumentInput,
} from '@agency/shared';

import { api, unwrap } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

import { invalidateMoney } from '@/features/projects/projects.hooks';

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
  sentAt?: string;
  signedAt?: string;
  brief?: SowBriefRow;
  createdAt: string;
}

export type SowStatus = 'DRAFT' | 'SENT' | 'SIGNED';
export const SOW_STATUS_LABEL: Record<SowStatus, string> = { DRAFT: 'Draft', SENT: 'Sent', SIGNED: 'Signed' };
export const sowStatus = (s: Pick<SowRow, 'sentAt' | 'signedAt'>): SowStatus =>
  s.signedAt ? 'SIGNED' : s.sentAt ? 'SENT' : 'DRAFT';

/** Wire shape — dates as yyyy-mm-dd, null clears a field on update. */
export interface SowBody {
  clientId: string;
  projectId?: string | null;
  title: string;
  description?: string;
  totalValuePaise: number;
  currency?: string;
  milestones?: { title: string; amountPaise: number; dueDate?: string; status?: MilestoneStatus }[];
  sentAt?: string | null;
  signedAt?: string | null;
}

export const sowApi = {
  list: (params: { clientId?: string; projectId?: string } = {}) => unwrap<SowRow[]>(api.get('/sows', { params })),
  byId: (id: string) => unwrap<SowRow>(api.get(`/sows/${id}`)),
  create: (body: SowBody) => unwrap<SowRow>(api.post('/sows', body)),
  update: (id: string, body: Partial<SowBody>) => unwrap<SowRow>(api.patch(`/sows/${id}`, body)),
  remove: (id: string) => unwrap<{ ok: boolean }>(api.delete(`/sows/${id}`)),
  brief: (id: string) => unwrap<SowBriefRow>(api.get(`/sows/${id}/brief`)),
  publishBrief: (id: string, body: SowBriefInput) => unwrap<SowRow>(api.post(`/sows/${id}/brief`, body)),
  setDocument: (id: string, body: Omit<SowDocumentInput, 'signedAt'> & { signedAt?: string }) =>
    unwrap<SowRow>(api.post(`/sows/${id}/document`, body)),
  createProject: (id: string, body: Omit<CreateProjectFromSowInput, 'startDate' | 'endDate'> & { startDate?: string; endDate?: string }) =>
    unwrap<{ project: { _id: string; name: string; code: string }; sow: SowRow }>(api.post(`/sows/${id}/create-project`, body)),
};

const invalidateSows = (qc: QueryClient) => void qc.invalidateQueries({ queryKey: qk.sows.all() });

export function useSows(params: { clientId?: string; projectId?: string } = {}) {
  const clean = { clientId: params.clientId || undefined, projectId: params.projectId || undefined };
  return useQuery({
    queryKey: [...qk.sows.all(), 'list', clean],
    queryFn: () => sowApi.list(clean),
  });
}
export function useSow(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.sows.byId(id) : ['sows', 'undefined'],
    queryFn: () => sowApi.byId(id!),
    enabled: !!id,
  });
}
/** Errors are left to the caller's form. */
export function useCreateSow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SowBody) => sowApi.create(body),
    onSuccess: () => {
      invalidateSows(qc);
      toast.success('SOW created');
    },
  });
}
export function useUpdateSow(opts: { toast?: string | false } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: Partial<SowBody> }) => sowApi.update(vars.id, vars.body),
    onSuccess: () => {
      invalidateSows(qc);
      if (opts.toast !== false) toast.success(opts.toast ?? 'SOW updated');
    },
  });
}
export function useDeleteSow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sowApi.remove(id),
    onSuccess: () => {
      invalidateSows(qc);
      toast.success('SOW deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function usePublishSowBrief() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: SowBriefInput }) => sowApi.publishBrief(vars.id, vars.body),
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
    mutationFn: (vars: { id: string; body: Parameters<typeof sowApi.setDocument>[1] }) => sowApi.setDocument(vars.id, vars.body),
    onSuccess: () => {
      invalidateSows(qc);
      toast.success('Signed copy attached — SOW marked as signed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
/** Project from the SOW: budget, client and milestones copied, SOW linked. */
export function useCreateProjectFromSow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: Parameters<typeof sowApi.createProject>[1] }) => sowApi.createProject(vars.id, vars.body),
    onSuccess: (res) => {
      invalidateSows(qc);
      invalidateMoney(qc);
      void qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success(`Project ${res.project.name} created`);
    },
  });
}
