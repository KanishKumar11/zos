// Payouts ledger + freelancer directory Zod schemas.
import { z } from 'zod';

import { PayeeType, PayoutCategory, PayoutMethod } from '../enums';
import { objectIdSchema, optionalObjectIdSchema } from './common.schema';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Pick a date');

export const createPayoutSchema = z
  .object({
    payeeType: z.nativeEnum(PayeeType),
    userId: optionalObjectIdSchema,
    freelancerId: optionalObjectIdSchema,
    /** Optional — general bonuses/advances needn't belong to a project. */
    projectId: optionalObjectIdSchema,
    amountPaise: z.number({ invalid_type_error: 'Enter an amount' }).int().min(1, 'Enter an amount'),
    currency: z.string().length(3).default('INR'),
    paidAt: ymd,
    method: z.nativeEnum(PayoutMethod).default(PayoutMethod.BANK),
    reference: z.string().max(120).optional(),
    category: z.nativeEnum(PayoutCategory).default(PayoutCategory.PROJECT_FEE),
    note: z.string().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.payeeType === PayeeType.MEMBER && !v.userId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['userId'], message: 'Choose who you paid' });
    }
    if (v.payeeType === PayeeType.FREELANCER && !v.freelancerId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['freelancerId'], message: 'Choose who you paid' });
    }
  });
export type CreatePayoutInput = z.input<typeof createPayoutSchema>;
export type CreatePayoutParsed = z.output<typeof createPayoutSchema>;

export const updatePayoutSchema = z
  .object({
    projectId: z.union([objectIdSchema, z.literal(''), z.null()]).optional(),
    amountPaise: z.number().int().min(1).optional(),
    paidAt: ymd.optional(),
    method: z.nativeEnum(PayoutMethod).optional(),
    reference: z.string().max(120).optional(),
    category: z.nativeEnum(PayoutCategory).optional(),
    note: z.string().max(500).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });
export type UpdatePayoutInput = z.infer<typeof updatePayoutSchema>;

export const listPayoutsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(500).optional(),
  payeeType: z.nativeEnum(PayeeType).optional(),
  userId: objectIdSchema.optional(),
  freelancerId: objectIdSchema.optional(),
  projectId: objectIdSchema.optional(),
  clientId: objectIdSchema.optional(),
  method: z.nativeEnum(PayoutMethod).optional(),
  category: z.nativeEnum(PayoutCategory).optional(),
  from: ymd.optional(),
  to: ymd.optional(),
  q: z.string().max(120).optional(),
  sort: z.enum(['paidAt:desc', 'paidAt:asc', 'amount:desc', 'amount:asc']).optional(),
});
export type ListPayoutsQuery = z.infer<typeof listPayoutsQuerySchema>;

// ── Freelancer directory ────────────────────────────────────────────────────────────

export const freelancerInputSchema = z.object({
  name: z.string().min(2, 'Enter a name').max(120),
  email: z.union([z.string().email('Enter a valid email'), z.literal('')]).optional(),
  phone: z.string().max(30).optional(),
  skill: z.string().max(120).optional(),
  upiId: z.string().max(120).optional(),
  bankName: z.string().max(120).optional(),
  accountNumber: z.string().max(30).optional(),
  ifsc: z.string().max(20).optional(),
  pan: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
});
export type FreelancerInput = z.infer<typeof freelancerInputSchema>;
export const updateFreelancerSchema = freelancerInputSchema.partial();
export type UpdateFreelancerInput = z.infer<typeof updateFreelancerSchema>;

/** A freelancer's deal on a project (lives on the project). */
export const projectFreelancerInputSchema = z.object({
  freelancerId: objectIdSchema,
  agreedPaise: z.number().int().min(0).default(0),
  scope: z.string().max(300).optional(),
});
export type ProjectFreelancerInput = z.input<typeof projectFreelancerInputSchema>;

export const updateProjectFreelancerSchema = z.object({
  agreedPaise: z.number().int().min(0).optional(),
  scope: z.string().max(300).optional(),
});
export type UpdateProjectFreelancerInput = z.infer<typeof updateProjectFreelancerSchema>;

/** Link a migrated "legacy" freelancer agreement (free-text project) to a real project. */
export const linkLegacyEngagementSchema = z.object({
  legacyId: z.string().min(1),
  projectId: objectIdSchema,
});
export type LinkLegacyEngagementInput = z.infer<typeof linkLegacyEngagementSchema>;
