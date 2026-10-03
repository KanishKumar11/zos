// Invoices hooks.
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  InvoiceStatus,
  type CreateInvoiceInput,
  type ListInvoicesQuery,
  type RecordPaymentInput,
  type UpdateInvoiceInput,
} from '@agency/shared';

import { api, getErrorMessage, unwrap, unwrapPaginated } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import { invalidateMoney } from '@/features/projects/projects.hooks';

export interface InvoiceLineItemRow {
  description: string;
  qty: number;
  unitPaise: number;
  /** Set when the line bills a specific project — one invoice can span several. */
  projectId?: string;
  /** Milestone subdoc id within `projectId`. */
  milestoneId?: string;
  /** Set when the line bills a retainer — one invoice can cover several contracts. */
  contractId?: string;
}
export interface PaymentRow {
  _id: string;
  paidAt: string;
  amountPaise: number;
  reference: string;
  /** Method code (BANK_TRANSFER, UPI…) or legacy free text. */
  method: string;
  /** Human label for `method`. */
  methodLabel?: string;
}
export interface InvoiceRow {
  _id: string;
  number: string;
  clientId: string;
  /** null when the client record is gone — show "Deleted client". */
  clientName?: string | null;
  clientDeleted?: boolean;
  clientPaymentTermsDays?: number;
  projectId?: string;
  contractId?: string;
  /** Every project billed (header + lines); name null when the project was deleted. */
  projects?: { _id: string; name: string | null }[];
  contracts?: { _id: string; name: string | null }[];
  lineItems: InvoiceLineItemRow[];
  subTotalPaise: number;
  gstPercent: number;
  gstPaise: number;
  totalPaise: number;
  paidPaise: number;
  /** Still owed (0 once written off). */
  balancePaise?: number;
  currency: string;
  /** PARTIALLY_PAID is normalised to PARTIAL by the API. */
  status: InvoiceStatus;
  /** Has a balance and the due day has passed — true for late part-paid invoices too. */
  isOverdue?: boolean;
  daysOverdue?: number;
  /** Sent: client, line items, amounts and GST can no longer change. */
  locked?: boolean;
  issueDate?: string;
  dueDate?: string;
  sentAt?: string;
  writtenOffAt?: string;
  writeOffReason?: string;
  payments: PaymentRow[];
  notes: string;
  createdAt?: string;
}

export interface InvoiceListTotals {
  count: number;
  totalPaise: number;
  paidPaise: number;
  balancePaise: number;
  overduePaise: number;
}

/** Simple (unpaginated) filters accepted by `useInvoices`. */
export type InvoiceListParams = Pick<ListInvoicesQuery, 'status' | 'clientId' | 'projectId' | 'contractId'>;
/** Every filter the unpaginated list accepts (search and issue-date range included). */
export type InvoiceListFilters = Omit<ListInvoicesQuery, 'page' | 'pageSize' | 'sort'>;

export const invoicesApi = {
  /** Every match as an array — for summaries and per-client / per-project lists. */
  list: (params: InvoiceListFilters = {}) => unwrap<InvoiceRow[]>(api.get('/invoices', { params })),
  /** Paginated table with totals for the whole filtered set. */
  page: async (q: ListInvoicesQuery) => {
    const res = await unwrapPaginated<InvoiceRow>(api.get('/invoices', { params: { page: 1, ...q } }));
    const totals = (res.meta as unknown as { totals?: InvoiceListTotals }).totals;
    return {
      ...res,
      totals: totals ?? { count: res.meta.total, totalPaise: 0, paidPaise: 0, balancePaise: 0, overduePaise: 0 },
    };
  },
  byId: (id: string) => unwrap<InvoiceRow>(api.get(`/invoices/${id}`)),
  nextNumber: () => unwrap<{ number: string }>(api.get('/invoices/next-number')),
  create: (body: CreateInvoiceInput) => unwrap<InvoiceRow>(api.post('/invoices', body)),
  update: (id: string, body: UpdateInvoiceInput) => unwrap<InvoiceRow>(api.patch(`/invoices/${id}`, body)),
  send: (id: string) => unwrap<InvoiceRow>(api.post(`/invoices/${id}/send`)),
  writeOff: (id: string, reason: string) => unwrap<InvoiceRow>(api.post(`/invoices/${id}/write-off`, { reason })),
  reopen: (id: string) => unwrap<InvoiceRow>(api.post(`/invoices/${id}/reopen`)),
  duplicate: (id: string) => unwrap<InvoiceRow>(api.post(`/invoices/${id}/duplicate`)),
  pay: (id: string, body: RecordPaymentInput) => unwrap<InvoiceRow>(api.post(`/invoices/${id}/payments`, body)),
  removePayment: (id: string, paymentId: string) =>
    unwrap<InvoiceRow>(api.delete(`/invoices/${id}/payments/${paymentId}`)),
  remove: (id: string) => unwrap<{ ok: boolean }>(api.delete(`/invoices/${id}`)),
  dashboard: () => unwrap<InvoiceDashboard>(api.get('/invoices/dashboard')),
  aging: () => unwrap<InvoiceAgingBucket[]>(api.get('/invoices/aging')),
};

export interface InvoiceDashboard {
  billedPaise: number;
  collectedPaise: number;
  outstandingPaise: number;
  overduePaise: number;
  counts: Partial<Record<InvoiceStatus, number>>;
  openCount?: number;
  overdueCount?: number;
  draftCount?: number;
  draftPaise?: number;
  /** Payments received in the current Indian financial year. */
  collectedFyPaise?: number;
  /** e.g. "2026-27". */
  fyLabel?: string;
}
export interface InvoiceAgingBucket {
  range: string;
  countInvoices: number;
  openPaise: number;
}

/**
 * Everything an invoice change can move: every invoice query (lists, detail, dashboard, aging),
 * the owner dashboard, client stats and project money (project balances read invoice payments).
 */
export function invalidateInvoices(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ['invoices'] });
  void qc.invalidateQueries({ queryKey: ['clients'] });
  void qc.invalidateQueries({ queryKey: ['contracts'] });
  invalidateMoney(qc); // projects, payouts, dashboard, …
}

export function useInvoices(params: InvoiceListParams = {}) {
  return useQuery({
    queryKey: ['invoices', 'list', params],
    queryFn: () => invoicesApi.list(params),
  });
}
/** Every invoice matching the filters, unpaginated — for the status lanes and client-side filters. */
export function useInvoiceList(filters: InvoiceListFilters, enabled = true) {
  return useQuery({
    queryKey: ['invoices', 'list', filters],
    queryFn: () => invoicesApi.list(filters),
    enabled,
    placeholderData: keepPreviousData,
  });
}
export function useInvoicePage(q: ListInvoicesQuery, enabled = true) {
  return useQuery({
    queryKey: ['invoices', 'page', q],
    queryFn: () => invoicesApi.page(q),
    placeholderData: keepPreviousData,
    enabled,
  });
}
export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.invoices.byId(id) : ['invoices', 'undefined'],
    queryFn: () => invoicesApi.byId(id!),
    enabled: !!id,
  });
}
export function useNextInvoiceNumber(enabled = true) {
  return useQuery({ queryKey: ['invoices', 'next-number'], queryFn: invoicesApi.nextNumber, enabled, staleTime: 0 });
}

const onError = (err: unknown) => toast.error(getErrorMessage(err));

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateInvoiceInput) => invoicesApi.create(body),
    onSuccess: (inv) => {
      invalidateInvoices(qc);
      toast.success(`Draft ${inv.number} created`);
    },
    onError,
  });
}
export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: UpdateInvoiceInput }) => invoicesApi.update(vars.id, vars.body),
    onSuccess: () => {
      invalidateInvoices(qc);
      toast.success('Invoice updated');
    },
    onError,
  });
}
export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoicesApi.remove(id),
    onSuccess: () => {
      invalidateInvoices(qc);
      toast.success('Draft deleted');
    },
    onError,
  });
}
export function useSendInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoicesApi.send(id),
    onSuccess: (inv) => {
      invalidateInvoices(qc);
      toast.success(`${inv.number} marked as sent`);
    },
    onError,
  });
}
export function useWriteOffInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; reason: string }) => invoicesApi.writeOff(vars.id, vars.reason),
    onSuccess: (inv) => {
      invalidateInvoices(qc);
      toast.success(`${inv.number} written off`);
    },
    onError,
  });
}
export function useReopenInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoicesApi.reopen(id),
    onSuccess: (inv) => {
      invalidateInvoices(qc);
      toast.success(`${inv.number} reopened`);
    },
    onError,
  });
}
export function useDuplicateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoicesApi.duplicate(id),
    onSuccess: (inv) => {
      invalidateInvoices(qc);
      toast.success(`Draft ${inv.number} created`);
    },
    onError,
  });
}
/** Errors are left to the caller so the form can show them next to the field. */
export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: RecordPaymentInput }) => invoicesApi.pay(vars.id, vars.body),
    onSuccess: () => {
      invalidateInvoices(qc);
      toast.success('Payment recorded');
    },
  });
}
export function useRemoveInvoicePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; paymentId: string }) => invoicesApi.removePayment(vars.id, vars.paymentId),
    onSuccess: () => {
      invalidateInvoices(qc);
      toast.success('Payment removed');
    },
    onError,
  });
}

export function useInvoiceDashboard() {
  return useQuery({ queryKey: ['invoices', 'dashboard'], queryFn: invoicesApi.dashboard });
}
export function useInvoiceAging() {
  return useQuery({ queryKey: ['invoices', 'aging'], queryFn: invoicesApi.aging });
}
