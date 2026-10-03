// User-management Zod schemas.
import { z } from 'zod';

import { Role, UserStatus, isStaffRole } from '../enums';
import { isoDateSchema, objectIdSchema, phoneSchema } from './common.schema';

export const bankDetailsSchema = z.object({
  accountHolderName: z.string().min(2).max(120),
  accountNumber: z.string().min(6).max(30),
  ifsc: z.string().min(8).max(20),
  bankName: z.string().min(2).max(120),
  branch: z.string().max(120).optional(),
  upiId: z.string().max(120).optional(),
});
export type BankDetailsInput = z.infer<typeof bankDetailsSchema>;

/** Fields a user may change about themselves (PATCH /users/me). */
export const updateProfileSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: phoneSchema.optional(),
  avatarUrl: z.string().max(500).optional(),
  dateOfBirth: isoDateSchema.optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** Employment fields — only OWNER/ADMIN may set these, never the user themselves. `null` clears a field. */
export const employmentFieldsSchema = z.object({
  dateOfJoining: isoDateSchema.nullable().optional(),
  /** Last working day — set when someone leaves (internship completed, resigned…). */
  dateOfExit: isoDateSchema.nullable().optional(),
  exitReason: z.enum(['INTERNSHIP_COMPLETED', 'RESIGNED', 'CONTRACT_ENDED', 'LET_GO', 'OTHER']).nullable().optional(),
  departmentId: objectIdSchema.nullable().optional(),
  designationId: objectIdSchema.nullable().optional(),
  reportingManagerId: objectIdSchema.nullable().optional(),
});

export const adminUpdateUserSchema = updateProfileSchema.merge(employmentFieldsSchema).extend({
  role: z.nativeEnum(Role).refine(isStaffRole, 'Portal users are invited from the client page').optional(),
  status: z.nativeEnum(UserStatus).optional(),
});
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  q: z.string().max(120).optional(),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  departmentId: objectIdSchema.optional(),
  sort: z
    .enum(['name:asc', 'name:desc', 'lastLoginAt:asc', 'lastLoginAt:desc', 'dateOfJoining:asc', 'dateOfJoining:desc', 'createdAt:asc', 'createdAt:desc'])
    .optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const userDocumentInputSchema = z.object({
  kind: z.enum(['OFFER_LETTER', 'NDA', 'CONTRACT', 'ID_PROOF', 'OTHER']),
  name: z.string().min(1).max(200),
  key: z.string().min(1).max(500),
  contentType: z.string().max(120).optional(),
  sizeBytes: z.number().int().min(0).optional(),
});
export type UserDocumentInput = z.infer<typeof userDocumentInputSchema>;

export const onboardingItemSchema = z.object({
  item: z.string().min(1).max(200),
  completed: z.boolean().optional(),
});
export type OnboardingItemInput = z.infer<typeof onboardingItemSchema>;

export const onboardingPatchSchema = z.object({
  items: z.array(onboardingItemSchema).max(100),
});
export type OnboardingPatchInput = z.infer<typeof onboardingPatchSchema>;
