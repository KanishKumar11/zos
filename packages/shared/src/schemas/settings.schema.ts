// Settings + Holidays Zod schemas.
import { z } from 'zod';

import { isoDateSchema } from './common.schema';

export const updateSettingsSchema = z.object({
  workspaceName: z.string().min(2).max(120).optional(),
  defaultCurrency: z.string().length(3).optional(),
  timezone: z.string().min(1).max(80).optional(),
  locale: z.string().min(2).max(20).optional(),
  weekendDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  annualLeavePerYear: z.number().int().min(0).max(60).optional(),
  sickLeavePerYear: z.number().int().min(0).max(60).optional(),
  logoKey: z.string().max(500).optional(),
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
  gstin: z.string().max(20).optional(),
  pan: z.string().max(20).optional(),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export const createHolidaySchema = z.object({
  name: z.string().min(2).max(120),
  date: isoDateSchema,
  optional: z.boolean().optional(),
  note: z.string().max(500).optional(),
});
export const updateHolidaySchema = createHolidaySchema.partial();
export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;
export type UpdateHolidayInput = z.infer<typeof updateHolidaySchema>;
