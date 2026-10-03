// Project Zod schemas.
import { z } from 'zod';

import { PayoutMethod, ProjectMemberRole, ProjectStatus } from '../enums';
import { isoDateSchema, objectIdSchema, optionalObjectIdSchema } from './common.schema';

export const projectMemberInputSchema = z.object({
  userId: objectIdSchema,
  role: z.nativeEnum(ProjectMemberRole),
  amountPaise: z.number().int().min(0).optional(),
});
export type ProjectMemberInput = z.infer<typeof projectMemberInputSchema>;

export const setMemberCostSchema = z.object({
  amountPaise: z.number().int().min(0),
});
export type SetMemberCostInput = z.infer<typeof setMemberCostSchema>;

export const addMemberPaymentSchema = z.object({
  amountPaise: z.number().int().min(1),
  paidAt: z.string(),
  note: z.string().max(200).optional(),
  forPeriod: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});
export type AddMemberPaymentInput = z.infer<typeof addMemberPaymentSchema>;

export const createProjectSchema = z.object({
  name: z.string().min(2).max(160),
  code: z.string().min(2).max(40),
  description: z.string().max(2000).optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
  brief: z.string().max(20_000).optional(),
  members: z.array(projectMemberInputSchema).optional(),
  // OWNER-only fields (server enforces guard)
  clientId: optionalObjectIdSchema,
  clientBudgetPaise: z.number().int().min(0).optional(),
  /** Budget minus team/freelancer cost — legitimately negative when a project runs over. */
  agencyMarginPaise: z.number().int().optional(),
  /** When false the project is hidden from the client portal. */
  portalVisible: z.boolean().optional(),
  currency: z.string().length(3).optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' });
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const listProjectsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(500).optional(),
  q: z.string().min(1).optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  clientId: objectIdSchema.optional(),
});
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;

export const createMilestoneSchema = z.object({
  name: z.string().min(1).max(200),
  amountPaise: z.number().int().min(0),
  dueDate: z.string().optional(),
  note: z.string().max(500).optional(),
});
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;

export const updateMilestoneSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  amountPaise: z.number().int().min(0).optional(),
  dueDate: z.string().optional(),
  note: z.string().max(500).optional(),
  status: z.enum(['PENDING', 'INVOICED', 'COLLECTED']).optional(),
  invoiceId: objectIdSchema.optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' });
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;

/** What happens to someone's agreed fee when they stop working on a project or it closes. */
export const SETTLE_ACTIONS = ['PAY_REST', 'SETTLE_AT_PAID', 'KEEP_OWED'] as const;
export type SettleAction = (typeof SETTLE_ACTIONS)[number];

const settleFields = {
  /** Date to record on a PAY_REST payment (yyyy-mm-dd). */
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  method: z.nativeEnum(PayoutMethod).optional(),
  note: z.string().max(500).optional(),
};

/** OWNER: someone stops working on a project. Their history stays; their fee is settled one way. */
export const releaseMemberSchema = z.object({
  action: z.enum(SETTLE_ACTIONS),
  ...settleFields,
});
export type ReleaseMemberInput = z.infer<typeof releaseMemberSchema>;

/** OWNER: close a project — mark it done, optionally write off what the client won't pay, settle people. */
export const closeProjectSchema = z.object({
  writeOff: z.boolean().default(false),
  people: z
    .array(
      z.object({
        payeeType: z.enum(['MEMBER', 'FREELANCER']),
        id: objectIdSchema,
        action: z.enum(SETTLE_ACTIONS),
      }),
    )
    .max(100)
    .default([]),
  ...settleFields,
});
export type CloseProjectInput = z.input<typeof closeProjectSchema>;
