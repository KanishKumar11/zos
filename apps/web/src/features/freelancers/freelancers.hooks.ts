// Freelancer directory API hooks.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { FreelancerInput, UpdateFreelancerInput } from '@agency/shared';

import { api, unwrap } from '@/lib/api-client';

import { invalidateMoney } from '@/features/projects/projects.hooks';
import type { BalanceRow } from '@/features/payouts/payouts.hooks';

export interface FreelancerRow {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  skill?: string;
  upiId?: string;
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  pan?: string;
  notes?: string;
  legacyEngagements: { legacyId: string; projectRef: string; agreedPaise: number }[];
  projectCount: number;
  agreedPaise: number;
  paidPaise: number;
  pendingPaise: number;
  lastPaidAt?: string;
}

export interface FreelancerDetail extends Omit<FreelancerRow, 'projectCount' | 'agreedPaise' | 'paidPaise' | 'pendingPaise'> {
  balances: BalanceRow[];
}

const freelancersApi = {
  list: (q?: string) => unwrap<FreelancerRow[]>(api.get('/freelancers', { params: { q: q || undefined } })),
  byId: (id: string) => unwrap<FreelancerDetail>(api.get(`/freelancers/${id}`)),
  create: (body: FreelancerInput) => unwrap<FreelancerRow>(api.post('/freelancers', body)),
  update: (id: string, body: UpdateFreelancerInput) => unwrap<FreelancerRow>(api.patch(`/freelancers/${id}`, body)),
  remove: (id: string) => unwrap<{ ok: true }>(api.delete(`/freelancers/${id}`)),
  linkLegacy: (id: string, legacyId: string, projectId: string) =>
    unwrap<FreelancerDetail>(api.post(`/freelancers/${id}/link-legacy`, { legacyId, projectId })),
};

export function useFreelancers(q?: string, opts: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: ['freelancers', 'list', q ?? ''], queryFn: () => freelancersApi.list(q), enabled: opts.enabled });
}

export function useFreelancer(id: string | undefined) {
  return useQuery({ queryKey: ['freelancers', 'detail', id], queryFn: () => freelancersApi.byId(id!), enabled: !!id });
}

export function useCreateFreelancer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FreelancerInput) => freelancersApi.create(body),
    onSuccess: (f) => {
      qc.invalidateQueries({ queryKey: ['freelancers'] });
      toast.success(`${f.name} added`);
    },
  });
}

export function useUpdateFreelancer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: UpdateFreelancerInput }) => freelancersApi.update(vars.id, vars.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['freelancers'] });
      toast.success('Freelancer saved');
    },
  });
}

export function useDeleteFreelancer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => freelancersApi.remove(id),
    onSuccess: () => {
      invalidateMoney(qc);
      toast.success('Freelancer removed');
    },
  });
}

export function useLinkLegacyEngagement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; legacyId: string; projectId: string }) =>
      freelancersApi.linkLegacy(vars.id, vars.legacyId, vars.projectId),
    onSuccess: () => {
      invalidateMoney(qc);
      toast.success('Linked to project');
    },
  });
}
