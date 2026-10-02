// SOW Zod schemas.
import { z } from 'zod';

import { MilestoneStatus } from '../enums';
import { isoDateSchema } from './common.schema';

/** '' from an untouched input means "not provided". */
const blank = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema.optional());

/** Optional field that can also be cleared: '' or null → null (the server unsets it). */
const clearable = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), schema.nullable().optional());

const idField = (message: string) =>
  z.string({ required_error: message, invalid_type_error: message }).regex(/^[a-f0-9]{24}$/i, message);

export const sowMilestoneInputSchema = z.object({
  title: z.string().trim().min(1, 'Name this milestone').max(160),
  amountPaise: z
    .number({ required_error: 'Enter an amount', invalid_type_error: 'Enter an amount' })
    .int()
    .min(0, 'Amount cannot be negative'),
  dueDate: blank(isoDateSchema),
  status: z.nativeEnum(MilestoneStatus).optional(),
});
export type SowMilestoneInput = z.infer<typeof sowMilestoneInputSchema>;

const sowFields = z.object({
  clientId: idField('Pick a client'),
  /** null on update unlinks the project. */
  projectId: clearable(idField('Pick a project')),
  title: z.string().trim().min(2, 'Give the SOW a title').max(200),
  description: z.string().max(20_000).optional(),
  totalValuePaise: z
    .number({ required_error: 'Enter the total value', invalid_type_error: 'Enter the total value' })
    .int()
    .min(0, 'Value cannot be negative'),
  currency: blank(z.string().trim().toUpperCase().length(3, 'Use a 3-letter currency code, e.g. INR')),
  milestones: z.array(sowMilestoneInputSchema).optional(),
  /** When the SOW went to the client for signature. null clears it. */
  sentAt: clearable(isoDateSchema),
  /** When the client signed. null clears it (back to draft / sent). */
  signedAt: clearable(isoDateSchema),
});

export const createSowSchema = sowFields;
export type CreateSowInput = z.infer<typeof createSowSchema>;

export const updateSowSchema = sowFields.partial().refine(
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

/** Attach the signed copy. `signedAt` defaults to today; it marks the SOW as signed. */
export const sowDocumentSchema = z.object({
  key: z.string().min(1).max(500),
  contentType: z.string().max(120).optional(),
  signedAt: blank(isoDateSchema),
});
export type SowDocumentInput = z.infer<typeof sowDocumentSchema>;

/** Turn a SOW into a project: budget = SOW value, milestones copied over, SOW linked to it. */
export const createProjectFromSowSchema = z.object({
  name: z.string().trim().min(2, 'Give the project a name').max(160),
  code: z.string().trim().toUpperCase().min(2, 'Add a short code, e.g. WEB-24').max(40),
  startDate: blank(isoDateSchema),
  endDate: blank(isoDateSchema),
});
export type CreateProjectFromSowInput = z.infer<typeof createProjectFromSowSchema>;
