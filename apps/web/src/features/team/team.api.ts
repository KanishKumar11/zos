// Team API client.
import { api, unwrap, unwrapPaginated } from '@/lib/api-client';

import type {
  AdminUpdateUserInput,
  BankDetailsInput,
  ListUsersQuery,
  OnboardingPatchInput,
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
  uploadedAt?: string;
  createdAt?: string;
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
  departmentId?: string | null;
  designationId?: string | null;
  reportingManagerId?: string | null;
  dateOfJoining?: string | null;
  dateOfBirth?: string;
  lastLoginAt?: string;
  createdAt?: string;
  documents?: UserDocumentRow[];
  onboardingChecklist?: OnboardingItemRow[];
  bio?: string;
  skills?: string[];
  /** Only returned to the person themselves and the owner. */
  bankDetails?: {
    accountHolderName: string;
    accountNumberLast4: string;
    ifsc: string;
    bankName: string;
    branch?: string;
    upiId?: string;
  };
}

/** An open (not accepted, not cancelled) team invite. */
export interface InviteRow {
  _id: string;
  email: string;
  name: string;
  role: Role;
  expiresAt: string;
  expired: boolean;
  lastSentAt: string;
  sendCount: number;
}

export interface InviteInput {
  email: string;
  name: string;
  role: Role;
  departmentId?: string;
  designationId?: string;
}

export interface InviteResult {
  ok: boolean;
  expiresAt: string;
  /** False when the invite was created but the email couldn't be sent. */
  emailed: boolean;
  inviteId?: string;
}

export const DOCUMENT_KIND_LABEL: Record<UserDocumentRow['kind'], string> = {
  OFFER_LETTER: 'Offer letter',
  NDA: 'NDA',
  CONTRACT: 'Contract',
  ID_PROOF: 'ID proof',
  OTHER: 'Other',
};

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  LEAD: 'Lead',
  MEMBER: 'Member',
  INTERN: 'Intern',
  CLIENT: 'Client',
};

export const teamApi = {
  /** First page only (array). Prefer `page` for lists. */
  list: (q: ListUsersQuery) =>
    unwrap<UserRow[]>(api.get('/users', { params: q })),
  /** Paginated list (keeps total / page count). */
  page: (q: ListUsersQuery) => unwrapPaginated<UserRow>(api.get('/users', { params: q })),
  /** Every staff member, for pickers. */
  directory: () => unwrapPaginated<UserRow>(api.get('/users', { params: { pageSize: 100, sort: 'name:asc' } })),
  byId: (id: string) => unwrap<UserRow>(api.get(`/users/${id}`)),
  me: () => unwrap<UserRow>(api.get('/users/me')),
  updateMe: (body: UpdateProfileInput) => unwrap<UserRow>(api.patch('/users/me', body)),
  updateBank: (body: BankDetailsInput) => unwrap<UserRow>(api.patch('/users/me/bank', body)),
  adminUpdate: (id: string, body: AdminUpdateUserInput) =>
    unwrap<UserRow>(api.patch(`/users/${id}`, body)),
  deactivate: (id: string) => unwrap<UserRow>(api.post(`/users/${id}/deactivate`, {})),
  reactivate: (id: string) => unwrap<UserRow>(api.post(`/users/${id}/reactivate`, {})),
  remove: (id: string) => unwrap<{ ok: boolean }>(api.delete(`/users/${id}`)),
  // Invites (OWNER/ADMIN)
  invite: (input: InviteInput) => unwrap<InviteResult>(api.post('/auth/invite', input)),
  invites: () => unwrap<InviteRow[]>(api.get('/auth/invites')),
  resendInvite: (id: string) => unwrap<InviteResult>(api.post(`/auth/invites/${id}/resend`, {})),
  cancelInvite: (id: string) => unwrap<{ ok: boolean }>(api.delete(`/auth/invites/${id}`)),
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
