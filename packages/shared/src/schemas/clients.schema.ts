// Clients + CRM Zod schemas.
import { z } from 'zod';

import { CrmStage } from '../enums';
import { isoDateSchema, objectIdSchema } from './common.schema';

export const clientContactSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  role: z.string().max(80).optional(),
});

export const createClientSchema = z.object({
  name: z.string().min(2).max(200),
  gstin: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  contacts: z.array(clientContactSchema).optional(),
  notes: z.string().max(20_000).optional(),
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = createClientSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: 'no fields to update' },
);
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export const createOpportunitySchema = z.object({
  clientId: objectIdSchema,
  title: z.string().min(2).max(200),
  valuePaise: z.number().int().min(0),
  currency: z.string().length(3).optional(),
  stage: z.nativeEnum(CrmStage).optional(),
  expectedCloseDate: isoDateSchema.optional(),
  ownerId: objectIdSchema.optional(),
  notes: z.string().max(20_000).optional(),
});
export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;

export const updateOpportunitySchema = createOpportunitySchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: 'no fields to update' },
);
export type UpdateOpportunityInput = z.infer<typeof updateOpportunitySchema>;

export const moveOpportunitySchema = z.object({
  stage: z.nativeEnum(CrmStage),
  position: z.number(),
});
export type MoveOpportunityInput = z.infer<typeof moveOpportunitySchema>;
