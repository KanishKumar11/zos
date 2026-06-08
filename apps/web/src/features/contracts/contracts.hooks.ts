// Contracts API + hooks.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  ContractStatus,
  type CreateContractInput,
  type ListContractsQuery,
  type UpdateContractInput,
} from '@agency/shared';

import { api, unwrap } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

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
  createdAt: string;
}

const contractsApi = {
  list: (q: ListContractsQuery = {}) =>
    unwrap<ContractRow[]>(api.get('/contracts', { params: q })),
  byId: (id: string) => unwrap<ContractRow>(api.get(`/contracts/${id}`)),
  create: (body: CreateContractInput) =>
    unwrap<ContractRow>(api.post('/contracts', body)),
  update: (id: string, body: UpdateContractInput) =>
    unwrap<ContractRow>(api.patch(`/contracts/${id}`, body)),
  remove: (id: string) => unwrap<{ ok: boolean }>(api.delete(`/contracts/${id}`)),
};

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

export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateContractInput) => contractsApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('Contract created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: UpdateContractInput }) =>
      contractsApi.update(vars.id, vars.body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.contracts.byId(vars.id) });
      qc.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('Contract updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => contractsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('Contract removed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
