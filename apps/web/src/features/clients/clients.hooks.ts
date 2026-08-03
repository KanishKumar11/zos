// Clients + CRM hooks (OWNER-only).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  CrmStage,
  type CreateClientInput,
  type CreateOpportunityInput,
  type MoveOpportunityInput,
  type UpdateClientInput,
  type UpdateOpportunityInput,
} from '@agency/shared';

import { api, unwrap } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

export interface ClientContactRow {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
}
export interface ClientRow {
  _id: string;
  name: string;
  gstin: string;
  address: string;
  contacts: ClientContactRow[];
  notes: string;
  createdAt: string;
}
export interface OpportunityRow {
  _id: string;
  clientId: string;
  title: string;
  valuePaise: number;
  currency: string;
  stage: CrmStage;
  expectedCloseDate?: string;
  ownerId?: string;
  position: number;
  notes: string;
}

export const clientsApi = {
  list: (search?: string) => unwrap<ClientRow[]>(api.get('/clients', { params: { search } })),
  byId: (id: string) => unwrap<ClientRow>(api.get(`/clients/${id}`)),
  create: (body: CreateClientInput) => unwrap<ClientRow>(api.post('/clients', body)),
  update: (id: string, body: UpdateClientInput) =>
    unwrap<ClientRow>(api.patch(`/clients/${id}`, body)),
  remove: (id: string) => unwrap<{ ok: boolean }>(api.delete(`/clients/${id}`)),
};

export const crmApi = {
  list: (stage?: CrmStage) =>
    unwrap<OpportunityRow[]>(api.get('/crm/opportunities', { params: { stage } })),
  byId: (id: string) => unwrap<OpportunityRow>(api.get(`/crm/opportunities/${id}`)),
  create: (body: CreateOpportunityInput) =>
    unwrap<OpportunityRow>(api.post('/crm/opportunities', body)),
  update: (id: string, body: UpdateOpportunityInput) =>
    unwrap<OpportunityRow>(api.patch(`/crm/opportunities/${id}`, body)),
  move: (id: string, body: MoveOpportunityInput) =>
    unwrap<OpportunityRow>(api.patch(`/crm/opportunities/${id}/move`, body)),
  remove: (id: string) => unwrap<{ ok: boolean }>(api.delete(`/crm/opportunities/${id}`)),
};

export function useClients(search?: string) {
  return useQuery({ queryKey: [...qk.clients.all(), search], queryFn: () => clientsApi.list(search) });
}
export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.clients.byId(id) : ['clients', 'undefined'],
    queryFn: () => clientsApi.byId(id!),
    enabled: !!id,
  });
}
export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateClientInput) => clientsApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.clients.all() });
      toast.success('Client created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: UpdateClientInput }) =>
      clientsApi.update(vars.id, vars.body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.clients.byId(vars.id) });
      qc.invalidateQueries({ queryKey: qk.clients.all() });
      toast.success('Client updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clientsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.clients.all() });
      toast.success('Client deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function usePipeline() {
  return useQuery({ queryKey: qk.crm.pipeline(), queryFn: () => crmApi.list() });
}
export function useCreateOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOpportunityInput) => crmApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.crm.pipeline() });
      toast.success('Opportunity added');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
export function useMoveOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: MoveOpportunityInput }) =>
      crmApi.move(vars.id, vars.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.crm.pipeline() }),
  });
}
export function useOpportunity(id: string | undefined) {
  return useQuery({
    queryKey: id ? ['crm', 'opportunity', id] : ['crm', 'opportunity', 'undefined'],
    queryFn: () => crmApi.byId(id!),
    enabled: !!id,
  });
}
export function useUpdateOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: UpdateOpportunityInput }) =>
      crmApi.update(vars.id, vars.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.crm.pipeline() });
      toast.success('Opportunity updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
export function useDeleteOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => crmApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.crm.pipeline() });
      toast.success('Opportunity removed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
