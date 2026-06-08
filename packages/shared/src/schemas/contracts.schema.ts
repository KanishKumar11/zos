// Contracts Zod schemas.
import { z } from 'zod';

import { ContractStatus } from '../enums';
import { isoDateSchema, objectIdSchema } from './common.schema';

export const createContractSchema = z.object({
  name: z.string().min(2).max(120),
  clientId: objectIdSchema,
  description: z.string().max(1000).optional(),
  monthlyAmountPaise: z.number().int().min(0),
  currency: z.string().length(3).optional(),
  status: z.nativeEnum(ContractStatus).optional(),
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
  notes: z.string().max(5000).optional(),
});
export type CreateContractInput = z.infer<typeof createContractSchema>;

export const updateContractSchema = createContractSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' });
export type UpdateContractInput = z.infer<typeof updateContractSchema>;

export const listContractsQuerySchema = z.object({
  clientId: objectIdSchema.optional(),
  status: z.nativeEnum(ContractStatus).optional(),
});
export type ListContractsQuery = z.infer<typeof listContractsQuerySchema>;
