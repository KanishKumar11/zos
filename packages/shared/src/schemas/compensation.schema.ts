// Compensation Zod schemas.
import { z } from 'zod';

import { CompensationType } from '../enums';
import { isoDateSchema } from './common.schema';

export const upsertCompensationSchema = z.object({
  type: z.nativeEnum(CompensationType),
  baseAmount: z.number().int().min(0),
  currency: z.string().length(3).default('INR'),
  hra: z.number().int().min(0).default(0),
  specialAllowance: z.number().int().min(0).default(0),
  providentFundEmployee: z.number().int().min(0).default(0),
  providentFundEmployer: z.number().int().min(0).default(0),
  professionalTax: z.number().int().min(0).default(0),
  tdsMonthly: z.number().int().min(0).default(0),
  effectiveFrom: isoDateSchema,
  reason: z.string().max(500).optional(),
});
export type UpsertCompensationInput = z.infer<typeof upsertCompensationSchema>;
