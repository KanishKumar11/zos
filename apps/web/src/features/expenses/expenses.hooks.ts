// Expenses API + hooks (OWNER only).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { api, unwrap } from '@/lib/api-client';

export interface ExpenseRow {
  _id: string;
  title: string;
  description?: string;
  amountPaise: number;
  category: string;
  date: string;
  vendor?: string;
  currency: string;
  notes?: string;
  createdAt: string;
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
  currency?: string;
  notes?: string;
}

const expensesApi = {
  list: (params?: Record<string, string | number | undefined>) =>
    unwrap<ExpensePaginated>(api.get('/expenses', { params })),
  summary: (from?: string, to?: string) =>
    unwrap<ExpenseSummary>(api.get('/expenses/summary', { params: { from, to } })),
  create: (body: CreateExpenseInput) => unwrap<ExpenseRow>(api.post('/expenses', body)),
  remove: (id: string) => unwrap<{ ok: boolean }>(api.delete(`/expenses/${id}`)),
};

const QK = {
  list: (p?: object) => ['expenses', 'list', p ?? {}] as const,
  summary: () => ['expenses', 'summary'] as const,
};

export function useExpenses(params?: Record<string, string | number | undefined>) {
  return useQuery({ queryKey: QK.list(params), queryFn: () => expensesApi.list(params) });
}

export function useExpenseSummary(from?: string, to?: string) {
  return useQuery({ queryKey: QK.summary(), queryFn: () => expensesApi.summary(from, to) });
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
