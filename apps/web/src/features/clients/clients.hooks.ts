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
export interface ClientStats {
  activeProjects: number;
  totalProjects: number;
  invoicedPaise: number;
  collectedPaise: number;
  outstandingPaise: number;
  overduePaise: number;
  lastPaymentAt?: string;
  activeContracts: number;
  portalUsers: number;
}
export interface ClientRow {
  _id: string;
  name: string;
  gstin: string;
  pan?: string;
  cin: string;
  address: string;
  state?: string;
  billingEmail?: string;
  phone?: string;
  website?: string;
  referredBy?: string;
  paymentTermsDays?: number;
  contacts: ClientContactRow[];
  notes: string;
  createdAt: string;
  /** Only with useClientsWithStats. */
  stats?: ClientStats | null;
}

export interface PortalAccessRow {
  users: { _id: string; name: string; email: string; title?: string; status: string; lastLoginAt?: string }[];
  invites: { _id: string; email: string; name: string; title?: string; expired: boolean; expiresAt: string; lastSentAt: string; sendCount: number }[];
}
export interface OpportunityRow {
  _id: string;
  /** Unset while the deal is with a prospect that isn't a client yet (see prospectName). */
  clientId?: string;
  prospectName?: string;
  title: string;
  valuePaise: number;
  currency: string;
  stage: CrmStage;
  /** Win chance %; unset → the stage default (CRM_STAGE_PROBABILITY). */
  probability?: number;
  expectedCloseDate?: string;
  ownerId?: string;
  position: number;
  notes: string;
  lostReason?: string;
  /** When it reached WON / LOST. */
  closedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}
/** Wire shape for create/update — dates as yyyy-mm-dd, null clears a field. */
export type OpportunityBody = Omit<CreateOpportunityInput, 'expectedCloseDate'> & { expectedCloseDate?: string | null };

export const clientsApi = {
  list: (search?: string) => unwrap<ClientRow[]>(api.get('/clients', { params: { search } })),
  byId: (id: string) => unwrap<ClientRow>(api.get(`/clients/${id}`)),
  create: (body: CreateClientInput) => unwrap<ClientRow>(api.post('/clients', body)),
  update: (id: string, body: UpdateClientInput) =>
    unwrap<ClientRow>(api.patch(`/clients/${id}`, body)),
  remove: (id: string) => unwrap<{ ok: boolean }>(api.delete(`/clients/${id}`)),
  listWithStats: (search?: string) =>
    unwrap<ClientRow[]>(api.get('/clients', { params: { search: search || undefined, withStats: '1' } })),
  stats: (id: string) => unwrap<ClientStats | null>(api.get(`/clients/${id}/stats`)),
  portal: (id: string) => unwrap<PortalAccessRow>(api.get(`/clients/${id}/portal`)),
  invitePortal: (id: string, body: { email: string; name: string; title?: string }) =>
    unwrap<{ ok: true; emailed: boolean }>(api.post(`/clients/${id}/portal/invite`, body)),
  resendPortalInvite: (id: string, inviteId: string) =>
    unwrap<{ ok: true; emailed: boolean }>(api.post(`/clients/${id}/portal/invites/${inviteId}/resend`)),
  revokePortalInvite: (id: string, inviteId: string) => unwrap<{ ok: true }>(api.delete(`/clients/${id}/portal/invites/${inviteId}`)),
  disablePortalUser: (id: string, userId: string) => unwrap<{ ok: true }>(api.post(`/clients/${id}/portal/users/${userId}/disable`)),
  enablePortalUser: (id: string, userId: string) => unwrap<{ ok: true }>(api.post(`/clients/${id}/portal/users/${userId}/enable`)),
};

export const crmApi = {
  list: (stage?: CrmStage) =>
    unwrap<OpportunityRow[]>(api.get('/crm/opportunities', { params: { stage } })),
  byId: (id: string) => unwrap<OpportunityRow>(api.get(`/crm/opportunities/${id}`)),
  create: (body: OpportunityBody) => unwrap<OpportunityRow>(api.post('/crm/opportunities', body)),
  update: (id: string, body: Partial<OpportunityBody> | UpdateOpportunityInput) =>
    unwrap<OpportunityRow>(api.patch(`/crm/opportunities/${id}`, body)),
  move: (id: string, body: MoveOpportunityInput) =>
    unwrap<OpportunityRow>(api.patch(`/crm/opportunities/${id}/move`, body)),
  convertToClient: (id: string) => unwrap<OpportunityRow>(api.post(`/crm/opportunities/${id}/convert-client`)),
  remove: (id: string) => unwrap<{ ok: boolean }>(api.delete(`/crm/opportunities/${id}`)),
};

/** Clients are OWNER-only — pass `enabled: false` for other roles so no request fails with 403. */
export function useClients(search?: string, opts: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: [...qk.clients.all(), search], queryFn: () => clientsApi.list(search), enabled: opts.enabled });
}
export function useClientsWithStats(search?: string, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...qk.clients.all(), 'stats', search ?? ''],
    queryFn: () => clientsApi.listWithStats(search),
    enabled: opts.enabled,
  });
}
export function useClientStats(id: string | undefined, opts: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: ['clients', id, 'stats'], queryFn: () => clientsApi.stats(id!), enabled: !!id && opts.enabled !== false });
}
export function usePortalAccess(id: string | undefined, opts: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: ['clients', id, 'portal'], queryFn: () => clientsApi.portal(id!), enabled: !!id && opts.enabled !== false });
}
function usePortalMutation<V>(fn: (v: V) => Promise<unknown>, message: (r: unknown) => string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      const m = message(r);
      if ((r as { emailed?: boolean })?.emailed === false) {
        toast.warning(m, { description: "The email couldn't be sent. Check mail settings, then use Resend." });
      } else toast.success(m);
    },
  });
}
export const useInvitePortalUser = () =>
  usePortalMutation((v: { id: string; body: { email: string; name: string; title?: string } }) => clientsApi.invitePortal(v.id, v.body), () => 'Invite sent');
export const useResendPortalInvite = () =>
  usePortalMutation((v: { id: string; inviteId: string }) => clientsApi.resendPortalInvite(v.id, v.inviteId), () => 'Invite re-sent with a new link');
export const useRevokePortalInvite = () =>
  usePortalMutation((v: { id: string; inviteId: string }) => clientsApi.revokePortalInvite(v.id, v.inviteId), () => 'Invite cancelled');
export const useDisablePortalUser = () =>
  usePortalMutation((v: { id: string; userId: string }) => clientsApi.disablePortalUser(v.id, v.userId), () => 'Portal access turned off');
export const useEnablePortalUser = () =>
  usePortalMutation((v: { id: string; userId: string }) => clientsApi.enablePortalUser(v.id, v.userId), () => 'Portal access turned on');

export function useClient(id: string | undefined, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: id ? qk.clients.byId(id) : ['clients', 'undefined'],
    queryFn: () => clientsApi.byId(id!),
    enabled: !!id && opts.enabled !== false,
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
  });
}

// ── CRM pipeline ─────────────────────────────────────────────────────────────────────

export function usePipeline() {
  return useQuery({ queryKey: qk.crm.pipeline(), queryFn: () => crmApi.list() });
}
/** Errors are left to the caller's form. */
export function useCreateOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OpportunityBody) => crmApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.crm.pipeline() });
      toast.success('Deal added');
    },
  });
}
/**
 * Move a deal between stages. The card moves instantly; on failure it snaps back and the error is
 * shown. The pipeline refetches either way so positions match the server.
 */
export function useMoveOpportunity() {
  const qc = useQueryClient();
  const key = qk.crm.pipeline();
  return useMutation({
    mutationFn: (vars: { id: string; body: MoveOpportunityInput }) => crmApi.move(vars.id, vars.body),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<OpportunityRow[]>(key);
      qc.setQueryData<OpportunityRow[]>(key, (rows) =>
        (rows ?? []).map((o) =>
          o._id === vars.id
            ? {
                ...o,
                stage: vars.body.stage,
                position: vars.body.position ?? Number.MAX_SAFE_INTEGER,
                lostReason: vars.body.stage === CrmStage.LOST ? (vars.body.lostReason ?? o.lostReason) : undefined,
                closedAt: vars.body.stage === CrmStage.WON || vars.body.stage === CrmStage.LOST ? new Date().toISOString() : undefined,
              }
            : o,
        ),
      );
      return { previous };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      toast.error(err.message || "Couldn't move the deal");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ['crm', 'opportunity'] });
    },
  });
}
export function useOpportunity(id: string | undefined) {
  return useQuery({
    queryKey: id ? ['crm', 'opportunity', id] : ['crm', 'opportunity', 'undefined'],
    queryFn: () => crmApi.byId(id!),
    enabled: !!id,
  });
}
/** Errors are left to the caller's form. */
export function useUpdateOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: Partial<OpportunityBody> }) => crmApi.update(vars.id, vars.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm'] });
      toast.success('Deal updated');
    },
  });
}
/** Won deal with a prospect → add them as a client (or link the existing client with that name). */
export function useConvertOpportunityToClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => crmApi.convertToClient(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm'] });
      qc.invalidateQueries({ queryKey: qk.clients.all() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
export function useDeleteOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => crmApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm'] });
      toast.success('Deal deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
