// Auth store — holds the current user (id/role/name) post-login. Server is source of truth;
// this is a cache populated by the /auth/me query and cleared on logout.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Role } from '@agency/shared';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl?: string;
}

interface AuthState {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      clear: () => set({ user: null }),
    }),
    { name: 'agency.auth' },
  ),
);
