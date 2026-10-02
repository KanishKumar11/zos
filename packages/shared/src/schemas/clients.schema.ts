// Clients + CRM Zod schemas.
import { z } from 'zod';

import { CrmStage } from '../enums';
import { isoDateSchema, objectIdSchema } from './common.schema';

/** '' from an untouched input means "not provided". */
const blank = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema.optional());

export const clientContactSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(120),
  email: blank(z.string().trim().email('Enter a valid email')),
  phone: blank(z.string().max(40)),
  role: blank(z.string().max(80)),
});
export type ClientContactInput = z.infer<typeof clientContactSchema>;

export const createClientSchema = z.object({
  name: z.string().trim().min(2, 'Enter the client name').max(200),
  gstin: blank(z.string().trim().toUpperCase().regex(/^[0-9]{2}[A-Z0-9]{13}$/, 'GSTIN is 15 characters, e.g. 27ABCDE1234F1Z5')),
  pan: blank(z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'PAN looks like ABCDE1234F')),
  cin: blank(z.string().max(30)),
  address: blank(z.string().max(500)),
  /** State for GST place of supply (e.g. "Maharashtra"). */
  state: blank(z.string().max(60)),
  billingEmail: blank(z.string().trim().email('Enter a valid email')),
  phone: blank(z.string().max(40)),
  website: blank(z.string().max(200)),
  paymentTermsDays: z.preprocess((v) => (v === '' || v === null ? undefined : v), z.coerce.number().int().min(0).max(180).optional()),
  contacts: z.array(clientContactSchema).optional(),
  notes: blank(z.string().max(20_000)),
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = createClientSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: 'no fields to update' },
);
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

// ── CRM pipeline ───────────────────────────────────────────────────────────────────────

/** Optional field that can also be cleared: '' or null → null (the server unsets it). */
const clearable = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), schema.nullable().optional());

/**
 * A deal is either for an existing client (`clientId`) or a prospect that isn't a client yet
 * (`prospectName`) — it becomes a client when the deal is won.
 */
const opportunityFields = z.object({
  clientId: clearable(objectIdSchema),
  prospectName: blank(z.string().trim().min(2, 'Enter the company name').max(200)),
  title: z.string().trim().min(2, 'Give the deal a name').max(200),
  valuePaise: z
    .number({ required_error: 'Enter the deal value', invalid_type_error: 'Enter the deal value' })
    .int()
    .min(0, 'Value cannot be negative'),
  currency: blank(z.string().trim().toUpperCase().length(3)),
  stage: z.nativeEnum(CrmStage).optional(),
  /** Win chance in %. Unset → the stage's default (see CRM_STAGE_PROBABILITY). */
  probability: clearable(z.coerce.number().int().min(0, '0–100').max(100, '0–100')),
  expectedCloseDate: clearable(isoDateSchema),
  ownerId: clearable(objectIdSchema),
  notes: z.string().max(20_000).optional(),
  lostReason: z.string().max(500).optional(),
});

const hasCompany = (v: { clientId?: string | null; prospectName?: string }) => !!v.clientId || !!v.prospectName;

export const createOpportunitySchema = opportunityFields.refine(hasCompany, {
  message: 'Pick a client or enter the prospect’s company name',
  path: ['clientId'],
});
export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;

export const updateOpportunitySchema = opportunityFields.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: 'no fields to update' },
);
export type UpdateOpportunityInput = z.infer<typeof updateOpportunitySchema>;

export const moveOpportunitySchema = z.object({
  stage: z.nativeEnum(CrmStage),
  /** Sort position inside the stage; omitted → end of the column. */
  position: z.number().optional(),
  /** Asked for when a deal moves to LOST. */
  lostReason: z.string().max(500).optional(),
});
export type MoveOpportunityInput = z.infer<typeof moveOpportunitySchema>;
