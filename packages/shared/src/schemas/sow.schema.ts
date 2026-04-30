// SOW Zod schemas.
import { z } from 'zod';

import { MilestoneStatus } from '../enums';
import { isoDateSchema, objectIdSchema } from './common.schema';

export const sowMilestoneInputSchema = z.object({
  title: z.string().min(2).max(160),
  amountPaise: z.number().int().min(0),
  dueDate: isoDateSchema.optional(),
  status: z.nativeEnum(MilestoneStatus).optional(),
});
export type SowMilestoneInput = z.infer<typeof sowMilestoneInputSchema>;

export const createSowSchema = z.object({
  clientId: objectIdSchema,
  projectId: objectIdSchema.optional(),
  title: z.string().min(2).max(200),
  description: z.string().max(20_000).optional(),
  totalValuePaise: z.number().int().min(0),
  currency: z.string().length(3).optional(),
  milestones: z.array(sowMilestoneInputSchema).optional(),
  signedAt: isoDateSchema.optional(),
});
export type CreateSowInput = z.infer<typeof createSowSchema>;

export const updateSowSchema = createSowSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: 'no fields to update' },
);
export type UpdateSowInput = z.infer<typeof updateSowSchema>;

export const sowBriefSchema = z.object({
  scopeSummary: z.string().min(2).max(5_000),
  deliverables: z.array(z.string().min(1).max(300)).min(1),
  timelineStart: isoDateSchema.optional(),
  timelineEnd: isoDateSchema.optional(),
  revisionRounds: z.number().int().min(0).max(99).optional(),
});
export type SowBriefInput = z.infer<typeof sowBriefSchema>;

export const sowDocumentSchema = z.object({
  key: z.string().min(1).max(500),
  contentType: z.string().max(120).optional(),
});
export type SowDocumentInput = z.infer<typeof sowDocumentSchema>;
