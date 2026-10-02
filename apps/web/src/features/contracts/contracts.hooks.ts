// Contracts API + hooks.
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  ContractStatus,
  type CreateContractInput,
  type GenerateClientInvoiceInput,
  type GenerateContractInvoiceInput,
  type ListContractsQuery,
  type UpdateContractInput,
} from '@agency/shared';

import { api, unwrap } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

/** Billing summary the API attaches to every contract. Drafts and written-off invoices aren't "billed". */
export interface ContractBilling {
  billedPaise: number;
  paidPaise: number;
  invoiceCount: number;
  /** YYYY-MM months that already have an invoice (drafts included). */
  billedMonths: string[];
}

export interface ContractRow {
  _id: string;
  name: string;
  clientId: string;
  description?: string;
  monthlyAmountPaise: number;
  currency: string;
  status: ContractStatus;
  startDate?: string;
  endDate?: string;
  notes?: string;
  billingDay?: number;
  /** Default GST % for invoices generated from this contract. */
  gstPercent?: number;
  createdAt: string;
  billing?: ContractBilling;
}

/** Wire shape: dates as yyyy-mm-dd strings, null clears a field on update. */
export type ContractBody = Omit<CreateContractInput, 'startDate' | 'endDate'> & {
  startDate?: string | null;
  endDate?: string | null;
};

const contractsApi = {
  list: (q: ListContractsQuery = {}) => unwrap<ContractRow[]>(api.get('/contracts', { params: q })),
  byId: (id: string) => unwrap<ContractRow>(api.get(`/contracts/${id}`)),
  create: (body: ContractBody) => unwrap<ContractRow>(api.post('/contracts', body)),
  update: (id: string, body: Partial<ContractBody>) => unwrap<ContractRow>(api.patch(`/contracts/${id}`, body)),
  remove: (id: string) => unwrap<{ ok: boolean }>(api.delete(`/contracts/${id}`)),
  generateInvoice: (id: string, body: GenerateContractInvoiceInput) =>
    unwrap<{ _id: string; number: string }>(api.post(`/contracts/${id}/generate-invoice`, body)),
  generateClientInvoice: (body: GenerateClientInvoiceInput) =>
    unwrap<{ _id: string; number: string }>(api.post('/contracts/generate-client-invoice', body)),
};

/** Contract changes move client stats and the dashboard's billing reminders. */
function invalidateContracts(qc: QueryClient, opts: { invoices?: boolean } = {}) {
  void qc.invalidateQueries({ queryKey: ['contracts'] });
  void qc.invalidateQueries({ queryKey: ['clients'] });
  void qc.invalidateQueries({ queryKey: ['dashboard'] });
  if (opts.invoices) void qc.invalidateQueries({ queryKey: ['invoices'] });
}

export function useContracts(q: ListContractsQuery = {}) {
  return useQuery({
    queryKey: qk.contracts.all(q as Record<string, unknown>),
    queryFn: () => contractsApi.list(q),
  });
}

export function useContract(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.contracts.byId(id) : ['contracts', 'undefined'],
    queryFn: () => contractsApi.byId(id!),
    enabled: !!id,
  });
}

/** Errors are left to the caller's form (field errors + message). */
export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ContractBody) => contractsApi.create(body),
    onSuccess: () => {
      invalidateContracts(qc);
      toast.success('Contract created');
    },
  });
}

export function useUpdateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: Partial<ContractBody> | UpdateContractInput }) =>
      contractsApi.update(vars.id, vars.body as Partial<ContractBody>),
    onSuccess: () => {
      invalidateContracts(qc);
      toast.success('Contract updated');
    },
  });
}

export function useDeleteContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => contractsApi.remove(id),
    onSuccess: () => {
      invalidateContracts(qc);
      toast.success('Contract deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useGenerateContractInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & GenerateContractInvoiceInput) => contractsApi.generateInvoice(id, body),
    onSuccess: (data) => {
      invalidateContracts(qc, { invoices: true });
      toast.success(`Invoice ${data.number} created as a draft`);
    },
  });
}

/** One invoice for several of a client's contracts — one line per contract. */
export function useGenerateClientInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: GenerateClientInvoiceInput) => contractsApi.generateClientInvoice(body),
    onSuccess: (data) => {
      invalidateContracts(qc, { invoices: true });
      toast.success(`Invoice ${data.number} created as a draft`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
