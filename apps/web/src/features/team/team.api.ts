// Team API client.
import { api, unwrap } from '@/lib/api-client';

import type {
  AdminUpdateUserInput,
  BankDetailsInput,
  ListUsersQuery,
  Paginated,
  UpdateProfileInput,
} from '@agency/shared';
import { Role, UserStatus } from '@agency/shared';

export interface UserRow {
  _id: string;
  email: string;
  name: string;
  phone?: string;
  avatarUrl?: string;
  role: Role;
  status: UserStatus;
  departmentId?: string;
  designationId?: string;
  reportingManagerId?: string;
  dateOfJoining?: string;
  dateOfBirth?: string;
  lastLoginAt?: string;
}

export const teamApi = {
  list: (q: ListUsersQuery) =>
    unwrap<{ items: UserRow[]; meta: Paginated<UserRow>['meta'] }>(api.get('/users', { params: q })),
  byId: (id: string) => unwrap<UserRow>(api.get(`/users/${id}`)),
  me: () => unwrap<UserRow>(api.get('/users/me')),
  updateMe: (body: UpdateProfileInput) => unwrap<UserRow>(api.patch('/users/me', body)),
  updateBank: (body: BankDetailsInput) => unwrap<UserRow>(api.patch('/users/me/bank', body)),
  adminUpdate: (id: string, body: AdminUpdateUserInput) =>
    unwrap<UserRow>(api.patch(`/users/${id}`, body)),
  deactivate: (id: string) => unwrap<UserRow>(api.post(`/users/${id}/deactivate`, {})),
  reactivate: (id: string) => unwrap<UserRow>(api.post(`/users/${id}/reactivate`, {})),
  remove: (id: string) => unwrap<{ ok: boolean }>(api.delete(`/users/${id}`)),
  invite: (input: { email: string; name: string; role: Role; departmentId?: string; designationId?: string }) =>
    unwrap<{ inviteId: string; expiresAt: string }>(api.post('/auth/invite', input)),
};
