// Auth feature API client. All functions return parsed payloads via `unwrap`.
import type { Role } from '@agency/shared';

import { api, unwrap } from '@/lib/api-client';
import type { AuthUser } from '@/store/auth.store';

export interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  login: (input: LoginPayload) =>
    unwrap<{ accessToken: string }>(api.post('/auth/login', input)),

  logout: () => api.post('/auth/logout'),

  me: () =>
    unwrap<{ id: string; email: string; name: string; role: Role; avatarUrl: string | null }>(
      api.get('/auth/me'),
    ).then(
      (u): AuthUser => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        avatarUrl: u.avatarUrl ?? undefined,
      }),
    ),

  acceptInvite: (input: { token: string; password: string; name?: string; phone?: string }) =>
    unwrap<{ userId: string }>(api.post('/auth/accept-invite', input)),

  forgotPassword: (input: { email: string }) =>
    unwrap<{ ok: true }>(api.post('/auth/forgot-password', input)),

  resetPassword: (input: { token: string; password: string; confirmPassword: string }) =>
    unwrap<{ ok: true }>(api.post('/auth/reset-password', input)),
};
