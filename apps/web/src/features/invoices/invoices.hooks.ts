// Invoices hooks.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  InvoiceStatus,
  type CreateInvoiceInput,
  type RecordPaymentInput,
  type UpdateInvoiceInput,
} from '@agency/shared';

import { api, unwrap } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

export interface InvoiceLineItemRow {
  description: string;
  qty: number;
  unitPaise: number;
}
export interface PaymentRow {
  _id: string;
  paidAt: string;
  amountPaise: number;
  reference: string;
  method: string;
}
export interface InvoiceRow {
  _id: string;
  number: string;
  clientId: string;
  projectId?: string;
  lineItems: InvoiceLineItemRow[];
  subTotalPaise: number;
  gstPercent: number;
  gstPaise: number;
  totalPaise: number;
  paidPaise: number;
  currency: string;
  status: InvoiceStatus;
  issueDate?: string;
  dueDate?: string;
  payments: PaymentRow[];
  notes: string;
}

export const invoicesApi = {
  list: (params: { status?: InvoiceStatus; clientId?: string } = {}) =>
    unwrap<InvoiceRow[]>(api.get('/invoices', { params })),
  byId: (id: string) => unwrap<InvoiceRow>(api.get(`/invoices/${id}`)),
  create: (body: CreateInvoiceInput) => unwrap<InvoiceRow>(api.post('/invoices', body)),
  update: (id: string, body: UpdateInvoiceInput) =>
    unwrap<InvoiceRow>(api.patch(`/invoices/${id}`, body)),
  send: (id: string) => unwrap<InvoiceRow>(api.post(`/invoices/${id}/send`)),
  pay: (id: string, body: RecordPaymentInput) =>
    unwrap<InvoiceRow>(api.post(`/invoices/${id}/payments`, body)),
};

export function useInvoices(params: { status?: InvoiceStatus; clientId?: string } = {}) {
  return useQuery({
    queryKey: [...qk.invoices.all(), params],
    queryFn: () => invoicesApi.list(params),
  });
}
export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.invoices.byId(id) : ['invoices', 'undefined'],
    queryFn: () => invoicesApi.byId(id!),
    enabled: !!id,
  });
}
export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateInvoiceInput) => invoicesApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.invoices.all() });
      toast.success('Invoice drafted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
export function useSendInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoicesApi.send(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: qk.invoices.byId(id) });
      qc.invalidateQueries({ queryKey: qk.invoices.all() });
    },
  });
}
export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: RecordPaymentInput }) =>
      invoicesApi.pay(vars.id, vars.body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.invoices.byId(vars.id) });
      qc.invalidateQueries({ queryKey: qk.invoices.all() });
      toast.success('Payment recorded');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
