// Payroll Zod schemas.
import { z } from 'zod';

export const createPayrollRunSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'expected YYYY-MM'),
  notes: z.string().max(2000).optional(),
});
export type CreatePayrollRunInput = z.infer<typeof createPayrollRunSchema>;

export const finalizePayrollRunSchema = z.object({
  notes: z.string().max(2000).optional(),
});
export type FinalizePayrollRunInput = z.infer<typeof finalizePayrollRunSchema>;
