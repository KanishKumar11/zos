// Projects API + hooks.
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  ProjectMemberRole,
  ProjectStatus,
  type CreateProjectInput,
  type ListProjectsQuery,
  type ProjectFreelancerInput,
  type ProjectMemberInput,
  type UpdateProjectFreelancerInput,
  type UpdateProjectInput,
} from '@agency/shared';

import { api, unwrap, unwrapPaginated } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

export interface MemberPaymentEntry {
  _id: string;
  paidAt: string;
  amountPaise: number;
  note?: string;
  method?: string;
  reference?: string;
}
export interface ProjectMemberRow {
  userId: string;
  role: ProjectMemberRole;
  addedAt: string;
  /** Display name (detail endpoint only). */
  name?: string;
  /** OWNER only — the agreed fee. Non-owners get their own deal in myEngagement instead. */
  amountPaise?: number;
}
export interface ProjectFreelancerRow {
  freelancerId: string;
  name?: string;
  agreedPaise: number;
  scope?: string;
  addedAt: string;
}

/** The viewer's own deal on a project — sent to non-OWNERs instead of everyone's pay. */
export interface MyEngagement {
  agreedPaise: number;
  paidPaise: number;
  pendingPaise: number;
  currency: string;
  payments: MemberPaymentEntry[];
}
export interface MilestoneRow {
  _id: string;
  name: string;
  /** OWNER only. */
  amountPaise?: number;
  dueDate?: string;
  status: 'PENDING' | 'INVOICED' | 'COLLECTED';
  invoiceId?: string;
  note?: string;
}

export interface ProjectRow {
  _id: string;
  name: string;
  code: string;
  description?: string;
  status: ProjectStatus;
  startDate?: string;
  endDate?: string;
  brief?: string;
  createdAt?: string;
  members: ProjectMemberRow[];
  milestones: MilestoneRow[];
  /** Non-OWNERs only; null when the viewer isn't on the project. */
  myEngagement?: MyEngagement | null;
  // OWNER-only (omitted by the API for everyone else)
  freelancers?: ProjectFreelancerRow[];
  clientId?: string;
  clientBudgetPaise?: number;
  agencyMarginPaise?: number;
  currency?: string;
  portalVisible?: boolean;
}

export interface ProjectBalance {
  budgetPaise: number;
  invoicedPaise: number;
  collectedPaise: number;
  teamAgreedPaise: number;
  freelancerAgreedPaise: number;
  teamPaidPaise: number;
  freelancerPaidPaise: number;
  disbursedPaise: number;
  inHandPaise: number;
  plannedMarginPaise: number;
}

const projectsApi = {
  list: (q: ListProjectsQuery = {}) => unwrapPaginated<ProjectRow>(api.get('/projects', { params: q })),
  byId: (id: string) => unwrap<ProjectRow>(api.get(`/projects/${id}`)),
  create: (body: CreateProjectInput) => unwrap<ProjectRow>(api.post('/projects', body)),
  update: (id: string, body: UpdateProjectInput) => unwrap<ProjectRow>(api.patch(`/projects/${id}`, body)),
  addMember: (id: string, body: ProjectMemberInput) => unwrap<ProjectRow>(api.post(`/projects/${id}/members`, body)),
  removeMember: (id: string, userId: string) => unwrap<ProjectRow>(api.delete(`/projects/${id}/members/${userId}`)),
  remove: (id: string) => unwrap<{ ok: boolean }>(api.delete(`/projects/${id}`)),
  setMemberCost: (id: string, userId: string, amountPaise: number) =>
    unwrap<ProjectRow>(api.patch(`/projects/${id}/members/${userId}/cost`, { amountPaise })),
  addFreelancer: (id: string, body: ProjectFreelancerInput) =>
    unwrap<ProjectRow>(api.post(`/projects/${id}/freelancers`, body)),
  updateFreelancer: (id: string, freelancerId: string, body: UpdateProjectFreelancerInput) =>
    unwrap<ProjectRow>(api.patch(`/projects/${id}/freelancers/${freelancerId}`, body)),
  removeFreelancer: (id: string, freelancerId: string) =>
    unwrap<ProjectRow>(api.delete(`/projects/${id}/freelancers/${freelancerId}`)),
  balance: (id: string) => unwrap<ProjectBalance>(api.get(`/projects/${id}/balance`)),
  addMilestone: (id: string, body: { name: string; amountPaise: number; dueDate?: string; note?: string }) =>
    unwrap<ProjectRow>(api.post(`/projects/${id}/milestones`, body)),
  updateMilestone: (id: string, milestoneId: string, body: Record<string, unknown>) =>
    unwrap<ProjectRow>(api.patch(`/projects/${id}/milestones/${milestoneId}`, body)),
  removeMilestone: (id: string, milestoneId: string) =>
    unwrap<{ ok: boolean }>(api.delete(`/projects/${id}/milestones/${milestoneId}`)),
};

/** Anything that changes who is owed what refreshes every money view at once. */
export function invalidateMoney(qc: QueryClient): void {
  for (const key of ['projects', 'payouts', 'freelancers', 'dashboard', 'earnings', 'users']) {
    void qc.invalidateQueries({ queryKey: [key] });
  }
}

export function useProjects(q: ListProjectsQuery = {}, opts: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: [...qk.projects.all(), q], queryFn: () => projectsApi.list(q), enabled: opts.enabled });
}
/** Every project (for pickers). */
export function useAllProjects(opts: { enabled?: boolean } = {}) {
  return useProjects({ pageSize: 500 }, opts);
}
export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.projects.byId(id) : ['projects', 'undefined'],
    queryFn: () => projectsApi.byId(id!),
    enabled: !!id,
  });
}
export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProjectInput) => projectsApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created');
    },
  });
}
export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: UpdateProjectInput }) => projectsApi.update(vars.id, vars.body),
    onSuccess: () => {
      invalidateMoney(qc);
      toast.success('Project updated');
    },
  });
}
export function useAddProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: ProjectMemberInput }) => projectsApi.addMember(vars.id, vars.body),
    onSuccess: () => {
      invalidateMoney(qc);
      toast.success('Added to project');
    },
  });
}
export function useRemoveProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; userId: string }) => projectsApi.removeMember(vars.id, vars.userId),
    onSuccess: () => {
      invalidateMoney(qc);
      toast.success('Removed from project');
    },
  });
}
export function useSetMemberCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; userId: string; amountPaise: number }) =>
      projectsApi.setMemberCost(vars.id, vars.userId, vars.amountPaise),
    onSuccess: () => {
      invalidateMoney(qc);
      toast.success('Agreed fee saved');
    },
  });
}
export function useAddProjectFreelancer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: ProjectFreelancerInput }) => projectsApi.addFreelancer(vars.id, vars.body),
    onSuccess: () => {
      invalidateMoney(qc);
      toast.success('Freelancer added to project');
    },
  });
}
export function useUpdateProjectFreelancer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; freelancerId: string; body: UpdateProjectFreelancerInput }) =>
      projectsApi.updateFreelancer(vars.id, vars.freelancerId, vars.body),
    onSuccess: () => {
      invalidateMoney(qc);
      toast.success('Freelancer deal saved');
    },
  });
}
export function useRemoveProjectFreelancer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; freelancerId: string }) => projectsApi.removeFreelancer(vars.id, vars.freelancerId),
    onSuccess: () => {
      invalidateMoney(qc);
      toast.success('Freelancer removed from project');
    },
  });
}
export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: () => {
      invalidateMoney(qc);
      toast.success('Project deleted');
    },
  });
}
export function useProjectBalance(id: string | undefined) {
  return useQuery({
    queryKey: ['projects', id, 'balance'],
    queryFn: () => projectsApi.balance(id!),
    enabled: !!id,
  });
}
export function useAddMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; name: string; amountPaise: number; dueDate?: string; note?: string }) =>
      projectsApi.addMilestone(vars.id, { name: vars.name, amountPaise: vars.amountPaise, dueDate: vars.dueDate, note: vars.note }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.projects.byId(vars.id) });
      toast.success('Milestone added');
    },
  });
}
export function useUpdateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; milestoneId: string; body: Record<string, unknown> }) =>
      projectsApi.updateMilestone(vars.id, vars.milestoneId, vars.body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.projects.byId(vars.id) });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}
export function useRemoveMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; milestoneId: string }) => projectsApi.removeMilestone(vars.id, vars.milestoneId),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.projects.byId(vars.id) });
      toast.success('Milestone removed');
    },
  });
}
