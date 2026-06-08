// Project Zod schemas.
import { z } from 'zod';

import { ProjectMemberRole, ProjectStatus } from '../enums';
import { objectIdSchema, isoDateSchema } from './common.schema';

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

export const setMemberPaidSchema = z.object({
  paidPaise: z.number().int().min(0),
});
export type SetMemberPaidInput = z.infer<typeof setMemberPaidSchema>;

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
  clientId: objectIdSchema.optional(),
  clientBudgetPaise: z.number().int().min(0).optional(),
  agencyMarginPaise: z.number().int().min(0).optional(),
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
