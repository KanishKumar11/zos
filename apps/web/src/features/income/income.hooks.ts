// Income API + hooks (OWNER only) — non-client revenue (affiliate, referral, etc.).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { api, unwrap, unwrapPaginated } from '@/lib/api-client';

export interface IncomeRow {
  _id: string;
  title: string;
  description?: string;
  amountPaise: number;
  category: string;
  date: string;
  source?: string;
  currency: string;
  createdAt: string;
}

export interface IncomeSummary {
  byCategory: Array<{ _id: string; totalPaise: number; count: number }>;
  grandTotalPaise: number;
}

export interface IncomePaginated {
  items: IncomeRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateIncomeInput {
  title: string;
  description?: string;
  amountPaise: number;
  category: string;
  date: string;
  source?: string;
  currency?: string;
}

const incomeApi = {
  list: (params?: Record<string, string | number | undefined>) =>
    unwrapPaginated<IncomeRow>(api.get('/income', { params })),
  summary: (from?: string, to?: string) =>
    unwrap<IncomeSummary>(api.get('/income/summary', { params: { from, to } })),
  create: (body: CreateIncomeInput) => unwrap<IncomeRow>(api.post('/income', body)),
  remove: (id: string) => unwrap<{ ok: boolean }>(api.delete(`/income/${id}`)),
};

const QK = {
  list: (p?: object) => ['income', 'list', p ?? {}] as const,
  summary: (from?: string, to?: string) => ['income', 'summary', from ?? '', to ?? ''] as const,
};

export function useIncome(params?: Record<string, string | number | undefined>) {
  return useQuery({ queryKey: QK.list(params), queryFn: () => incomeApi.list(params) });
}

export function useIncomeSummary(from?: string, to?: string) {
  return useQuery({ queryKey: QK.summary(from, to), queryFn: () => incomeApi.summary(from, to) });
}

export function useCreateIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateIncomeInput) => incomeApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income'] });
      toast.success('Income added');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => incomeApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income'] });
      toast.success('Income removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
