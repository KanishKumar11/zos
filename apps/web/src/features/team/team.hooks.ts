// React Query hooks for team management.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type {
  AdminUpdateUserInput,
  BankDetailsInput,
  ListUsersQuery,
  OnboardingPatchInput,
  Role,
  UpdateProfileInput,
  UserDocumentInput,
} from '@agency/shared';

import { qk } from '@/lib/query-keys';

import { teamApi } from './team.api';

export function useTeamList(q: ListUsersQuery) {
  return useQuery({ queryKey: qk.users.list(q), queryFn: () => teamApi.list(q) });
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
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateMyBank() {
  return useMutation({
    mutationFn: (body: BankDetailsInput) => teamApi.updateBank(body),
    onSuccess: () => toast.success('Bank details saved'),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAdminUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: AdminUpdateUserInput }) =>
      teamApi.adminUpdate(vars.id, vars.body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.users.all() });
      qc.invalidateQueries({ queryKey: qk.users.byId(vars.id) });
      toast.success('User updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => teamApi.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.users.all() });
      toast.success('User deactivated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
export function useReactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => teamApi.reactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.users.all() });
      toast.success('User reactivated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useInviteMember() {
  return useMutation({
    mutationFn: (input: {
      email: string;
      name: string;
      role: Role;
      departmentId?: string;
      designationId?: string;
    }) => teamApi.invite(input),
    onSuccess: () => toast.success('Invite sent'),
    onError: (err: Error) => toast.error(err.message),
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
    onError: (err: Error) => toast.error(err.message),
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
    onError: (err: Error) => toast.error(err.message),
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
      toast.success('Checklist saved');
    },
    onError: (err: Error) => toast.error(err.message),
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
    onError: (err: Error) => toast.error(err.message),
  });
}
