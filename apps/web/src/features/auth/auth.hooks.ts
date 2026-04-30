// Auth React Query hooks (useMe, useLogin, useLogout, useAcceptInvite, etc).
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { queryKeys } from '@/lib/query-keys';
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
      router.push('/dashboard');
    },
    onError: (err: { error?: { message?: string } } | Error) => {
      const msg = (err as { error?: { message?: string } })?.error?.message ?? 'Login failed';
      toast.error(msg);
    },
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

export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: { email: string }) => authApi.forgotPassword(input),
    onSuccess: () => toast.success('If that email exists, a reset link has been sent.'),
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
    onSuccess: () => {
      toast.success('Account activated. Please log in.');
      router.push('/login');
    },
  });
}
