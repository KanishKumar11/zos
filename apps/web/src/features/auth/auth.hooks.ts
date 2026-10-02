// Auth React Query hooks (useMe, useLogin, useLogout, useAcceptInvite, etc).
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { getErrorMessage } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { homeForRole, isPortalPath } from '@/lib/route-rules';
import { useAuthStore } from '@/store/auth.store';

import { authApi, type LoginPayload } from './auth.api';

export function useMe() {
  const setUser = useAuthStore((s) => s.setUser);
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: async () => {
      const u = await authApi.me();
      setUser(u);
      return u;
    },
    staleTime: 60_000,
  });
}

/** Honour ?next= from the login redirect, but only for a same-site path in the role's own area. */
function postLoginPath(role: string): string {
  const home = homeForRole(role);
  if (typeof window === 'undefined') return home;
  const next = new URLSearchParams(window.location.search).get('next');
  if (!next || !next.startsWith('/') || next.startsWith('//')) return home;
  if ((role === 'CLIENT') !== isPortalPath(next)) return home;
  return next;
}

export function useLogin() {
  const router = useRouter();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginPayload) => authApi.login(input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.auth.me() });
      const me = await authApi.me();
      useAuthStore.getState().setUser(me);
      toast.success(`Welcome back, ${me.name}`);
      router.push(postLoginPath(me.role));
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Login failed')),
  });
}

export function useLogout() {
  const router = useRouter();
  const clear = useAuthStore((s) => s.clear);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      clear();
      qc.clear();
      router.push('/login');
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
      authApi.changePassword(input),
    onSuccess: () => toast.success('Password changed. Other devices have been signed out.'),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: { email: string }) => authApi.forgotPassword(input),
  });
}

export function useResetPassword() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { token: string; password: string; confirmPassword: string }) =>
      authApi.resetPassword(input),
    onSuccess: () => {
      toast.success('Password reset. Please log in.');
      router.push('/login');
    },
  });
}

export function useAcceptInvite() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { token: string; password: string; name?: string; phone?: string }) =>
      authApi.acceptInvite(input),
    // The page shows the error inline; skip the global toast.
    onError: () => undefined,
    onSuccess: () => {
      toast.success('Account activated. Please log in.');
      router.push('/login');
    },
  });
}
