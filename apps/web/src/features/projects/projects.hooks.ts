// Projects API + hooks.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  ProjectMemberRole,
  ProjectStatus,
  type CreateProjectInput,
  type ListProjectsQuery,
  type ProjectMemberInput,
  type UpdateProjectInput,
} from '@agency/shared';
import type { SetMemberCostInput, SetMemberPaidInput } from '@agency/shared';

import { api, unwrap, unwrapPaginated } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

export interface ProjectMemberRow {
  userId: string;
  role: ProjectMemberRole;
  addedAt: string;
  amountPaise: number;
  paidPaise: number;
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
  members: ProjectMemberRow[];
  // OWNER-only (will be undefined/redacted for non-OWNERs)
  clientId?: string;
  clientBudgetPaise?: number;
  agencyMarginPaise?: number;
  currency?: string;
}

export interface MemberCostRow {
  userId: string;
  name: string;
  totalPaidPaise: number;
}

const projectsApi = {
  list: (q: ListProjectsQuery = {}) =>
    unwrapPaginated<ProjectRow>(api.get('/projects', { params: q })),
  byId: (id: string) => unwrap<ProjectRow>(api.get(`/projects/${id}`)),
  create: (body: CreateProjectInput) => unwrap<ProjectRow>(api.post('/projects', body)),
  update: (id: string, body: UpdateProjectInput) =>
    unwrap<ProjectRow>(api.patch(`/projects/${id}`, body)),
  addMember: (id: string, body: ProjectMemberInput) =>
    unwrap<ProjectRow>(api.post(`/projects/${id}/members`, body)),
  removeMember: (id: string, userId: string) =>
    unwrap<ProjectRow>(api.delete(`/projects/${id}/members/${userId}`)),
  remove: (id: string) => unwrap<{ ok: boolean }>(api.delete(`/projects/${id}`)),
  memberCosts: (id: string) => unwrap<MemberCostRow[]>(api.get(`/projects/${id}/member-costs`)),
  setMemberCost: (id: string, userId: string, body: SetMemberCostInput) =>
    unwrap<ProjectRow>(api.patch(`/projects/${id}/members/${userId}/cost`, body)),
  setMemberPaid: (id: string, userId: string, body: SetMemberPaidInput) =>
    unwrap<ProjectRow>(api.patch(`/projects/${id}/members/${userId}/paid`, body)),
};

export function useProjects(q: ListProjectsQuery = {}) {
  return useQuery({ queryKey: [...qk.projects.all(), q], queryFn: () => projectsApi.list(q) });
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
    onError: (err: Error) => toast.error(err.message),
  });
}
export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: UpdateProjectInput }) => projectsApi.update(vars.id, vars.body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.projects.byId(vars.id) });
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
export function useAddProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: ProjectMemberInput }) => projectsApi.addMember(vars.id, vars.body),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: qk.projects.byId(vars.id) }),
  });
}
export function useSetMemberCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; userId: string; amountPaise: number }) =>
      projectsApi.setMemberCost(vars.id, vars.userId, { amountPaise: vars.amountPaise }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.projects.byId(vars.id) });
      qc.invalidateQueries({ queryKey: qk.projects.all() });
      toast.success('Saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSetMemberPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; userId: string; paidPaise: number }) =>
      projectsApi.setMemberPaid(vars.id, vars.userId, { paidPaise: vars.paidPaise }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.projects.byId(vars.id) });
      qc.invalidateQueries({ queryKey: qk.projects.all() });
      toast.success('Saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useProjectMemberCosts(id: string | undefined) {
  return useQuery({
    queryKey: id ? ['projects', id, 'member-costs'] : ['projects', 'undefined', 'member-costs'],
    queryFn: () => projectsApi.memberCosts(id!),
    enabled: !!id,
  });
}

export function useRemoveProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; userId: string }) => projectsApi.removeMember(vars.id, vars.userId),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: qk.projects.byId(vars.id) }),
  });
}
