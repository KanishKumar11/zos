// Team API client.
import { api, unwrap } from '@/lib/api-client';

import type {
  AdminUpdateUserInput,
  BankDetailsInput,
  ListUsersQuery,
  OnboardingPatchInput,
  Paginated,
  UpdateProfileInput,
  UserDocumentInput,
} from '@agency/shared';
import { Role, UserStatus } from '@agency/shared';

export interface UserDocumentRow {
  _id: string;
  kind: 'OFFER_LETTER' | 'NDA' | 'CONTRACT' | 'ID_PROOF' | 'OTHER';
  name: string;
  key: string;
  contentType?: string;
  sizeBytes?: number;
  uploadedAt: string;
  uploadedBy?: string;
}

export interface OnboardingItemRow {
  item: string;
  completed: boolean;
  completedAt?: string;
}

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
  documents?: UserDocumentRow[];
  onboardingChecklist?: OnboardingItemRow[];
  bio?: string;
  skills?: string[];
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
  // Member documents
  addDocument: (id: string, body: UserDocumentInput) =>
    unwrap<UserRow>(api.post(`/users/${id}/documents`, body)),
  removeDocument: (id: string, docId: string) =>
    unwrap<UserRow>(api.delete(`/users/${id}/documents/${docId}`)),
  documentUrl: (id: string, docId: string) =>
    unwrap<{ url: string; expiresIn: number }>(api.get(`/users/${id}/documents/${docId}/url`)),
  // Onboarding
  setOnboarding: (id: string, body: OnboardingPatchInput) =>
    unwrap<UserRow>(api.patch(`/users/${id}/onboarding`, body)),
  toggleOnboarding: (id: string, idx: number) =>
    unwrap<UserRow>(api.post(`/users/${id}/onboarding/${idx}/toggle`, {})),
};
