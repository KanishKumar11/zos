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

export const payslipAdjustmentSchema = z.object({
  kind: z.enum(['BONUS', 'DEDUCTION']),
  reason: z.string().min(2).max(200),
  amountPaise: z.number().int().min(1),
});
export type PayslipAdjustmentInput = z.infer<typeof payslipAdjustmentSchema>;

export const markPayrollPaidSchema = z.object({
  /** Day the money went out (YYYY-MM-DD). Defaults to today. */
  paidAt: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
});
export type MarkPayrollPaidInput = z.infer<typeof markPayrollPaidSchema>;

/** Why someone on the team has no payslip in a run. */
export enum PayrollSkipReason {
  NO_COMPENSATION = 'NO_COMPENSATION',
  PROJECT_BASED = 'PROJECT_BASED',
  NOT_JOINED = 'NOT_JOINED',
}

export const PAYROLL_SKIP_REASON_LABEL: Record<PayrollSkipReason, string> = {
  NO_COMPENSATION: 'No compensation set for this month',
  PROJECT_BASED: 'Paid per project, not on payroll',
  NOT_JOINED: 'Joins after this month',
};
