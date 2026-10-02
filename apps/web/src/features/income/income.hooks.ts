// Income API + hooks (OWNER only) — non-client revenue (affiliate, referral, etc.).
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { api, getErrorMessage, unwrap, unwrapPaginated } from '@/lib/api-client';

export interface IncomeRow {
  _id: string;
  title: string;
  description?: string;
  amountPaise: number;
  category: string;
  date: string;
  source?: string;
  receiptRef?: string;
  currency: string;
  createdAt: string;
}

export interface IncomeSummary {
  byCategory: Array<{ _id: string; totalPaise: number; count: number }>;
  grandTotalPaise: number;
  count: number;
}

export interface IncomeTotals {
  amountPaise: number;
  count: number;
}

export interface IncomePaginated {
  items: IncomeRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  totals: IncomeTotals;
}

export interface CreateIncomeInput {
  title: string;
  description?: string;
  amountPaise: number;
  category: string;
  date: string;
  source?: string;
  receiptRef?: string;
  currency?: string;
}

export type UpdateIncomeInput = Partial<CreateIncomeInput>;

export type IncomeSort = 'date:desc' | 'date:asc' | 'amount:desc' | 'amount:asc';

export interface IncomeFilters {
  q?: string;
  category?: string;
  from?: string;
  to?: string;
}

export interface IncomeListParams extends IncomeFilters {
  page?: number;
  limit?: number;
  sort?: IncomeSort;
}

const clean = <T extends object>(p: T): T =>
  Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== '')) as T;

export const incomeApi = {
  list: async (params: IncomeListParams = {}): Promise<IncomePaginated> => {
    const res = await unwrapPaginated<IncomeRow>(api.get('/income', { params: clean(params) }));
    const totals = (res.meta as unknown as { totals?: IncomeTotals }).totals;
    return { ...res, totals: totals ?? { amountPaise: 0, count: res.meta.total } };
  },
  summary: (filters: IncomeFilters = {}) => unwrap<IncomeSummary>(api.get('/income/summary', { params: clean(filters) })),
  create: (body: CreateIncomeInput) => unwrap<IncomeRow>(api.post('/income', body)),
  update: (id: string, body: UpdateIncomeInput) => unwrap<IncomeRow>(api.patch(`/income/${id}`, body)),
  remove: (id: string) => unwrap<{ ok: boolean }>(api.delete(`/income/${id}`)),
};

const QK = {
  list: (p: IncomeListParams) => ['income', 'list', clean(p)] as const,
  summary: (f: IncomeFilters) => ['income', 'summary', clean(f)] as const,
};

/** Other income feeds the dashboard's profit numbers. */
function invalidateIncomeViews(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ['income'] });
  void qc.invalidateQueries({ queryKey: ['dashboard'] });
}

export function useIncome(params: IncomeListParams = {}) {
  return useQuery({ queryKey: QK.list(params), queryFn: () => incomeApi.list(params), placeholderData: keepPreviousData });
}

export function useIncomeSummary(filters: IncomeFilters = {}) {
  return useQuery({ queryKey: QK.summary(filters), queryFn: () => incomeApi.summary(filters), placeholderData: keepPreviousData });
}

/** Forms show server errors inline, so create/update don't toast failures. */
export function useCreateIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateIncomeInput) => incomeApi.create(body),
    onSuccess: () => {
      invalidateIncomeViews(qc);
      toast.success('Income added');
    },
  });
}

export function useUpdateIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: UpdateIncomeInput }) => incomeApi.update(vars.id, vars.body),
    onSuccess: () => {
      invalidateIncomeViews(qc);
      toast.success('Income updated');
    },
  });
}

export function useDeleteIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => incomeApi.remove(id),
    onSuccess: () => {
      invalidateIncomeViews(qc);
      toast.success('Income deleted');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}
