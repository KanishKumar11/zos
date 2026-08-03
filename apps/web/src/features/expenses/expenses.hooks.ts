// Expenses API + hooks (OWNER only).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { api, unwrap } from '@/lib/api-client';

export interface ExpenseContribution {
  userId: string;
  amountPaise: number;
  note?: string;
}

export interface ExpenseRow {
  _id: string;
  title: string;
  description?: string;
  /** Gross amount, before any team-member contributions are recovered. */
  amountPaise: number;
  category: string;
  date: string;
  vendor?: string;
  receiptRef?: string;
  currency: string;
  addedBy?: string;
  contributions: ExpenseContribution[];
  createdAt: string;
}

export function netExpensePaise(e: Pick<ExpenseRow, 'amountPaise' | 'contributions'>): number {
  return e.amountPaise - e.contributions.reduce((s, c) => s + c.amountPaise, 0);
}

export interface ExpenseSummary {
  byCategory: Array<{ _id: string; totalPaise: number; count: number }>;
  grandTotalPaise: number;
}

export interface ExpensePaginated {
  items: ExpenseRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
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
  contributions?: ExpenseContribution[];
}

export type UpdateExpenseInput = Partial<CreateExpenseInput>;

export interface ExpenseListParams {
  page?: number;
  limit?: number;
  category?: string;
  from?: string;
  to?: string;
  contributorId?: string;
}

const expensesApi = {
  list: (params?: ExpenseListParams) =>
    unwrap<ExpensePaginated>(api.get('/expenses', { params })),
  summary: (from?: string, to?: string) =>
    unwrap<ExpenseSummary>(api.get('/expenses/summary', { params: { from, to } })),
  byId: (id: string) => unwrap<ExpenseRow>(api.get(`/expenses/${id}`)),
  create: (body: CreateExpenseInput) => unwrap<ExpenseRow>(api.post('/expenses', body)),
  update: (id: string, body: UpdateExpenseInput) =>
    unwrap<ExpenseRow>(api.patch(`/expenses/${id}`, body)),
  remove: (id: string) => unwrap<{ ok: boolean }>(api.delete(`/expenses/${id}`)),
};

const QK = {
  list: (p?: ExpenseListParams) => ['expenses', 'list', p ?? {}] as const,
  summary: (from?: string, to?: string) => ['expenses', 'summary', from ?? '', to ?? ''] as const,
  byId: (id: string) => ['expenses', 'detail', id] as const,
};

export function useExpenses(params?: ExpenseListParams, enabled = true) {
  return useQuery({ queryKey: QK.list(params), queryFn: () => expensesApi.list(params), enabled });
}

export function useExpense(id: string | undefined) {
  return useQuery({
    queryKey: id ? QK.byId(id) : ['expenses', 'detail', 'undefined'],
    queryFn: () => expensesApi.byId(id!),
    enabled: !!id,
  });
}

export function useExpenseSummary(from?: string, to?: string) {
  return useQuery({ queryKey: QK.summary(from, to), queryFn: () => expensesApi.summary(from, to) });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateExpenseInput) => expensesApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense added');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: UpdateExpenseInput }) => expensesApi.update(vars.id, vars.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expensesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
