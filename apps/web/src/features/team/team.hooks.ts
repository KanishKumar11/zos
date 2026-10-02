// React Query hooks for team management.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type {
  AdminUpdateUserInput,
  BankDetailsInput,
  ListUsersQuery,
  OnboardingPatchInput,
  UpdateProfileInput,
  UserDocumentInput,
} from '@agency/shared';

import { getErrorMessage } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

import { teamApi, type InviteInput, type InviteResult } from './team.api';

/** First page of members as a plain array (used by a few older pickers). */
export function useTeamList(q: ListUsersQuery) {
  return useQuery({ queryKey: qk.users.list(q), queryFn: () => teamApi.list(q) });
}

/** Paginated members — { items, meta }. */
export function useTeamPage(q: ListUsersQuery) {
  return useQuery({
    queryKey: ['users', 'page', q],
    queryFn: () => teamApi.page(q),
    placeholderData: keepPreviousData,
  });
}

/** All staff (not portal users) for pickers — cached for a few minutes. */
export function useStaffDirectory(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['users', 'directory'],
    queryFn: async () => (await teamApi.directory()).items,
    staleTime: 5 * 60_000,
    enabled: opts.enabled,
  });
}

export function useTeamMember(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.users.byId(id) : ['users', 'detail', 'undefined'],
    queryFn: () => teamApi.byId(id!),
    enabled: !!id,
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProfileInput) => teamApi.updateMe(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.auth.me() });
      qc.invalidateQueries({ queryKey: qk.users.all() });
      toast.success('Profile saved');
    },
  });
}

export function useMyProfile() {
  return useQuery({ queryKey: ['users', 'me'], queryFn: () => teamApi.me() });
}

export function useUpdateMyBank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BankDetailsInput) => teamApi.updateBank(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users', 'me'] });
      toast.success('Bank details saved');
    },
  });
}

/** Admin edit of a member. Errors are left to the caller so forms can show them inline. */
export function useAdminUpdateUser(opts: { successMessage?: string } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: AdminUpdateUserInput }) =>
      teamApi.adminUpdate(vars.id, vars.body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.users.all() });
      qc.invalidateQueries({ queryKey: qk.users.byId(vars.id) });
      qc.invalidateQueries({ queryKey: ['departments'] });
      toast.success(opts.successMessage ?? 'Saved');
    },
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => teamApi.deactivate(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: qk.users.all() });
      qc.invalidateQueries({ queryKey: qk.users.byId(id) });
      toast.success('Deactivated — they have been signed out');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}
export function useReactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => teamApi.reactivate(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: qk.users.all() });
      qc.invalidateQueries({ queryKey: qk.users.byId(id) });
      toast.success('Reactivated — they can sign in again');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}

function inviteToast(res: InviteResult, verb: string) {
  if (res.emailed) toast.success(`${verb} — invite email is on its way`);
  else
    toast.warning(`${verb}, but the email couldn't be sent`, {
      description: 'Check the mail settings, then use Resend from the pending invites list.',
    });
}

/** Invite a teammate. Errors are left to the dialog (field errors). Warns when the email didn't go out. */
export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteInput) => teamApi.invite(input),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['invites'] });
      inviteToast(res, 'Invite created');
    },
  });
}

export function usePendingInvites(enabled = true) {
  return useQuery({ queryKey: ['invites', 'staff'], queryFn: teamApi.invites, enabled });
}

export function useResendInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => teamApi.resendInvite(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['invites'] });
      inviteToast(res, 'New invite link created');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}

export function useCancelInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => teamApi.cancelInvite(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invites'] });
      toast.success('Invite cancelled — the link no longer works');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}

// Member documents
export function useAddMemberDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: UserDocumentInput }) =>
      teamApi.addDocument(vars.id, vars.body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.users.byId(vars.id) });
      toast.success('Document added');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}
export function useRemoveMemberDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; docId: string }) =>
      teamApi.removeDocument(vars.id, vars.docId),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.users.byId(vars.id) });
      toast.success('Document removed');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}

// Onboarding
export function useSetOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: OnboardingPatchInput }) =>
      teamApi.setOnboarding(vars.id, vars.body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.users.byId(vars.id) });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}
export function useToggleOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; idx: number }) =>
      teamApi.toggleOnboarding(vars.id, vars.idx),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.users.byId(vars.id) });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}
