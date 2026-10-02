// Expenses API + hooks (OWNER only).
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { api, getErrorMessage, unwrap, unwrapPaginated } from '@/lib/api-client';

export type ExpenseRecurring = 'NONE' | 'MONTHLY' | 'YEARLY';

export interface ExpenseContribution {
  userId: string;
  /** Resolved by the API; missing when the person no longer exists. */
  userName?: string;
  amountPaise: number;
  note?: string;
}

export interface ExpenseRow {
  _id: string;
  title: string;
  description?: string;
  /** Gross amount, before any team-member contributions are recovered. */
  amountPaise: number;
  /** Gross less contributions — what the agency actually bears. */
  netPaise?: number;
  category: string;
  date: string;
  vendor?: string;
  receiptRef?: string;
  currency: string;
  addedBy?: string;
  addedByName?: string;
  contributions: ExpenseContribution[];
  projectId?: string;
  projectName?: string;
  projectCode?: string;
  projectDeleted?: boolean;
  billable?: boolean;
  recurring?: ExpenseRecurring;
  repeatOfId?: string;
  createdAt: string;
}

export function netExpensePaise(e: Pick<ExpenseRow, 'amountPaise' | 'contributions'>): number {
  return e.amountPaise - e.contributions.reduce((s, c) => s + c.amountPaise, 0);
}

export interface ExpenseSummary {
  byCategory: Array<{ _id: string; totalPaise: number; netPaise: number; count: number }>;
  /** Gross total (kept for older callers). */
  grandTotalPaise: number;
  grossPaise: number;
  netPaise: number;
  count: number;
}

export interface ExpenseTotals {
  grossPaise: number;
  netPaise: number;
  count: number;
}

export interface ExpensePaginated {
  items: ExpenseRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  totals: ExpenseTotals;
}

export interface ContributionInput {
  userId: string;
  amountPaise: number;
  note?: string;
}

export interface CreateExpenseInput {
  title: string;
  description?: string;
  amountPaise: number;
  category: string;
  date: string;
  vendor?: string;
  receiptRef?: string;
  currency?: string;
  contributions?: ContributionInput[];
  projectId?: string | null;
  billable?: boolean;
  recurring?: ExpenseRecurring;
}

export type UpdateExpenseInput = Partial<CreateExpenseInput>;

export type ExpenseSort = 'date:desc' | 'date:asc' | 'amount:desc' | 'amount:asc';

export interface ExpenseFilters {
  q?: string;
  category?: string;
  from?: string;
  to?: string;
  contributorId?: string;
  projectId?: string;
  billable?: boolean;
  recurring?: ExpenseRecurring;
}

export interface ExpenseListParams extends ExpenseFilters {
  page?: number;
  limit?: number;
  sort?: ExpenseSort;
}

/** Drops empty values so they don't reach the query string (or the cache key). */
const clean = <T extends object>(p: T): T =>
  Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== '')) as T;

export const expensesApi = {
  list: async (params: ExpenseListParams = {}): Promise<ExpensePaginated> => {
    const res = await unwrapPaginated<ExpenseRow>(api.get('/expenses', { params: clean(params) }));
    const totals = (res.meta as unknown as { totals?: ExpenseTotals }).totals;
    return { ...res, totals: totals ?? { grossPaise: 0, netPaise: 0, count: res.meta.total } };
  },
  summary: (filters: ExpenseFilters = {}) =>
    unwrap<ExpenseSummary>(api.get('/expenses/summary', { params: clean(filters) })),
  byId: (id: string) => unwrap<ExpenseRow>(api.get(`/expenses/${id}`)),
  create: (body: CreateExpenseInput) => unwrap<ExpenseRow>(api.post('/expenses', body)),
  update: (id: string, body: UpdateExpenseInput) => unwrap<ExpenseRow>(api.patch(`/expenses/${id}`, body)),
  repeat: (id: string) => unwrap<ExpenseRow>(api.post(`/expenses/${id}/repeat`)),
  remove: (id: string) => unwrap<{ ok: boolean }>(api.delete(`/expenses/${id}`)),
};

const QK = {
  list: (p: ExpenseListParams) => ['expenses', 'list', clean(p)] as const,
  summary: (f: ExpenseFilters) => ['expenses', 'summary', clean(f)] as const,
  byId: (id: string) => ['expenses', 'detail', id] as const,
};

/** Expense totals feed the dashboard and project costs. */
function invalidateExpenseViews(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ['expenses'] });
  void qc.invalidateQueries({ queryKey: ['dashboard'] });
  void qc.invalidateQueries({ queryKey: ['projects'] });
}

export function useExpenses(params: ExpenseListParams = {}, enabled = true) {
  return useQuery({
    queryKey: QK.list(params),
    queryFn: () => expensesApi.list(params),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useExpense(id: string | undefined) {
  return useQuery({
    queryKey: id ? QK.byId(id) : ['expenses', 'detail', 'undefined'],
    queryFn: () => expensesApi.byId(id!),
    enabled: !!id,
  });
}

export function useExpenseSummary(filters: ExpenseFilters = {}) {
  return useQuery({
    queryKey: QK.summary(filters),
    queryFn: () => expensesApi.summary(filters),
    placeholderData: keepPreviousData,
  });
}

/** Forms show server errors inline, so create/update don't toast failures. */
export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateExpenseInput) => expensesApi.create(body),
    onSuccess: () => {
      invalidateExpenseViews(qc);
      toast.success('Expense added');
    },
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: UpdateExpenseInput }) => expensesApi.update(vars.id, vars.body),
    onSuccess: () => {
      invalidateExpenseViews(qc);
      toast.success('Expense updated');
    },
  });
}

export function useRepeatExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expensesApi.repeat(id),
    onSuccess: () => {
      invalidateExpenseViews(qc);
      toast.success('Next period added');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expensesApi.remove(id),
    onSuccess: () => {
      invalidateExpenseViews(qc);
      toast.success('Expense deleted');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
}
