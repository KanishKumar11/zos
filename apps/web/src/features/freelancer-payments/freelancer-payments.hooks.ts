// Freelancer Payments API + hooks (OWNER only).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { api, unwrap } from '@/lib/api-client';

export interface FreelancerPaymentEntry {
  date: string;
  amountPaise: number;
  note: string;
}

export interface FreelancerPaymentRow {
  _id: string;
  freelancerName: string;
  email?: string;
  projectRef: string;
  agreedTotalPaise: number;
  paidPaise: number;
  pendingPaise: number;
  payments: FreelancerPaymentEntry[];
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  currency: string;
  notes?: string;
  createdAt: string;
}

export interface FreelancerPaymentsPaginated {
  items: FreelancerPaymentRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateFreelancerPaymentInput {
  freelancerName: string;
  email?: string;
  projectRef: string;
  projectId?: string;
  agreedTotalPaise: number;
  currency?: string;
  notes?: string;
}

export interface AddPaymentEntryInput {
  date: string;
  amountPaise: number;
  note?: string;
}

const fpApi = {
  list: (params?: Record<string, string | number | undefined>) =>
    unwrap<FreelancerPaymentsPaginated>(api.get('/freelancer-payments', { params })),
  byProjectId: (projectId: string) =>
    unwrap<FreelancerPaymentRow[]>(api.get(`/freelancer-payments/project/${projectId}`)),
  create: (body: CreateFreelancerPaymentInput) =>
    unwrap<FreelancerPaymentRow>(api.post('/freelancer-payments', body)),
  addPayment: (id: string, body: AddPaymentEntryInput) =>
    unwrap<FreelancerPaymentRow>(api.post(`/freelancer-payments/${id}/pay`, body)),
  remove: (id: string) => unwrap<{ ok: boolean }>(api.delete(`/freelancer-payments/${id}`)),
};

const QK = {
  list: (p?: object) => ['freelancer-payments', 'list', p ?? {}] as const,
};

export function useFreelancerPayments(params?: Record<string, string | number | undefined>) {
  return useQuery({ queryKey: QK.list(params), queryFn: () => fpApi.list(params) });
}

export function useFreelancerPaymentsByProject(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? ['freelancer-payments', 'project', projectId] : ['freelancer-payments', 'project', 'undefined'],
    queryFn: () => fpApi.byProjectId(projectId!),
    enabled: !!projectId,
  });
}

export function useCreateFreelancerPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateFreelancerPaymentInput) => fpApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['freelancer-payments'] });
      toast.success('Contract added');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddFreelancerPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AddPaymentEntryInput }) =>
      fpApi.addPayment(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['freelancer-payments'] });
      toast.success('Payment logged');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteFreelancerPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fpApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['freelancer-payments'] });
      toast.success('Contract removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
