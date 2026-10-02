// Payouts ledger + earnings API hooks.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type {
  CreatePayoutInput,
  ListPayoutsQuery,
  PayeeType,
  PayoutCategory,
  PayoutMethod,
  UpdatePayoutInput,
} from '@agency/shared';

import { api, unwrap, unwrapPaginated } from '@/lib/api-client';
import { formatPaise } from '@/lib/formatters';

import { invalidateMoney } from '@/features/projects/projects.hooks';

export interface PayoutRow {
  _id: string;
  payeeType: PayeeType;
  userId?: string;
  freelancerId?: string;
  payeeName: string;
  projectId?: string;
  projectName?: string;
  projectCode?: string;
  amountPaise: number;
  currency: string;
  paidAt: string;
  method: PayoutMethod;
  reference: string;
  category: PayoutCategory;
  note: string;
  createdAt?: string;
}

export interface BalanceRow {
  payeeType: PayeeType;
  payeeId: string;
  payeeName: string;
  projectId: string | null;
  projectName: string;
  projectCode?: string;
  projectStatus?: string;
  agreedPaise: number;
  paidPaise: number;
  pendingPaise: number;
  lastPaidAt?: string;
  payoutCount: number;
}

export interface MyEarnings {
  totals: { thisMonthPaise: number; thisFyPaise: number; allTimePaise: number; pendingPaise: number };
  projects: Omit<BalanceRow, 'payeeName' | 'payeeId' | 'payeeType'>[];
  payouts: Omit<PayoutRow, 'payeeName' | 'userId' | 'freelancerId'>[];
}

export interface ImportStatus {
  memberPayments: number;
  memberPaymentsPaise: number;
  freelancerRecords: number;
  freelancerPayments: number;
  pending: boolean;
}

export const payoutsApi = {
  list: async (q: ListPayoutsQuery) => {
    const res = await unwrapPaginated<PayoutRow>(api.get('/payouts', { params: q }));
    const totals = (res.meta as unknown as { totals?: { amountPaise: number; count: number } }).totals;
    return { ...res, totals: totals ?? { amountPaise: 0, count: res.meta.total } };
  },
  create: (body: CreatePayoutInput) =>
    unwrap<PayoutRow & { overAgreed: boolean; agreedPaise: number; paidPaise: number }>(api.post('/payouts', body)),
  byId: (id: string) => unwrap<PayoutRow>(api.get(`/payouts/${id}`)),
  update: (id: string, body: UpdatePayoutInput) => unwrap<PayoutRow>(api.patch(`/payouts/${id}`, body)),
  remove: (id: string) => unwrap<{ ok: true }>(api.delete(`/payouts/${id}`)),
  projectBalances: (id: string) => unwrap<BalanceRow[]>(api.get(`/payouts/balances/project/${id}`)),
  memberBalances: (id: string) => unwrap<BalanceRow[]>(api.get(`/payouts/balances/member/${id}`)),
  freelancerBalances: (id: string) => unwrap<BalanceRow[]>(api.get(`/payouts/balances/freelancer/${id}`)),
  owed: () =>
    unwrap<{
      team: { payeeId: string; name: string; pendingPaise: number; projects: number }[];
      freelancers: { payeeId: string; name: string; pendingPaise: number; projects: number }[];
    }>(api.get('/payouts/owed')),
  importStatus: () => unwrap<ImportStatus>(api.get('/payouts/import-status')),
  importLegacy: () =>
    unwrap<{ memberPayments: number; freelancerPayments: number; freelancersCreated: number; unmatched: { freelancer: string; projectRef: string }[] }>(
      api.post('/payouts/import'),
    ),
  myEarnings: () => unwrap<MyEarnings>(api.get('/me/earnings')),
};

export function usePayouts(q: ListPayoutsQuery, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['payouts', 'list', q],
    queryFn: () => payoutsApi.list(q),
    placeholderData: keepPreviousData,
    enabled: opts.enabled,
  });
}

export function usePayout(id: string | undefined) {
  return useQuery({ queryKey: ['payouts', 'detail', id], queryFn: () => payoutsApi.byId(id!), enabled: !!id });
}

export function useProjectPayoutBalances(projectId: string | undefined) {
  return useQuery({
    queryKey: ['payouts', 'balances', 'project', projectId],
    queryFn: () => payoutsApi.projectBalances(projectId!),
    enabled: !!projectId,
  });
}

export function usePayeeBalances(type: 'MEMBER' | 'FREELANCER', id: string | undefined, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['payouts', 'balances', type, id],
    queryFn: () => (type === 'MEMBER' ? payoutsApi.memberBalances(id!) : payoutsApi.freelancerBalances(id!)),
    enabled: !!id && opts.enabled !== false,
  });
}

export function useOwed(enabled = true) {
  return useQuery({ queryKey: ['payouts', 'owed'], queryFn: payoutsApi.owed, enabled });
}

export function useMyEarnings() {
  return useQuery({ queryKey: ['earnings', 'me'], queryFn: payoutsApi.myEarnings });
}

export function useImportStatus(enabled = true) {
  return useQuery({ queryKey: ['payouts', 'import-status'], queryFn: payoutsApi.importStatus, enabled });
}

export function useImportLegacy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: payoutsApi.importLegacy,
    onSuccess: (r) => {
      invalidateMoney(qc);
      toast.success(`Imported ${r.memberPayments + r.freelancerPayments} payments`, {
        description: r.unmatched.length
          ? `${r.unmatched.length} freelancer agreement(s) need a project — see Freelancers.`
          : undefined,
      });
    },
  });
}

export function useCreatePayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePayoutInput) => payoutsApi.create(body),
    onSuccess: (p) => {
      invalidateMoney(qc);
      const msg = `${formatPaise(p.amountPaise, p.currency)} to ${p.payeeName}${p.projectName ? ` · ${p.projectName}` : ''}`;
      if (p.overAgreed) {
        toast.warning('Payment logged — now above the agreed fee', {
          description: `${msg}. Paid ${formatPaise(p.paidPaise)} of ${formatPaise(p.agreedPaise)} agreed.`,
        });
      } else {
        toast.success('Payment logged', { description: msg });
      }
    },
  });
}

export function useUpdatePayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: UpdatePayoutInput }) => payoutsApi.update(vars.id, vars.body),
    onSuccess: () => {
      invalidateMoney(qc);
      toast.success('Payment updated');
    },
  });
}

export function useDeletePayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => payoutsApi.remove(id),
    onSuccess: () => {
      invalidateMoney(qc);
      toast.success('Payment deleted');
    },
  });
}
