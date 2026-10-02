// Contracts Zod schemas.
import { z } from 'zod';

import { ContractStatus } from '../enums';
import { isoDateSchema } from './common.schema';

/** '' from an untouched input means "not provided". */
const blank = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema.optional());

/** Optional field that can also be cleared: '' or null → null (the server unsets it). */
const clearable = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), schema.nullable().optional());

const clientIdField = z
  .string({ required_error: 'Pick a client', invalid_type_error: 'Pick a client' })
  .regex(/^[a-f0-9]{24}$/i, 'Pick a client');

export const contractMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Pick a month');

const contractFields = z.object({
  name: z.string().trim().min(2, 'Give the contract a name').max(120),
  clientId: clientIdField,
  description: z.string().max(1000).optional(),
  monthlyAmountPaise: z
    .number({ required_error: 'Enter the monthly amount', invalid_type_error: 'Enter the monthly amount' })
    .int()
    .min(0, 'Amount cannot be negative'),
  currency: blank(z.string().trim().toUpperCase().length(3, 'Use a 3-letter currency code, e.g. INR')),
  status: z.nativeEnum(ContractStatus).optional(),
  startDate: clearable(isoDateSchema),
  endDate: clearable(isoDateSchema),
  notes: z.string().max(5000).optional(),
  /** Day of the month the dashboard reminds you to bill (1–28). */
  billingDay: clearable(z.coerce.number().int().min(1, 'Pick a day from 1 to 28').max(28, 'Pick a day from 1 to 28')),
  /** GST % used by default when invoices are generated from this contract. */
  gstPercent: clearable(z.coerce.number().min(0, 'GST cannot be negative').max(50, 'GST looks too high')),
});

const endAfterStart = (v: { startDate?: Date | null; endDate?: Date | null }) =>
  !v.startDate || !v.endDate || v.endDate >= v.startDate;
const endAfterStartIssue = { message: 'End date must be on or after the start date', path: ['endDate'] };

export const createContractSchema = contractFields.refine(endAfterStart, endAfterStartIssue);
export type CreateContractInput = z.infer<typeof createContractSchema>;

export const updateContractSchema = contractFields
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' })
  .refine(endAfterStart, endAfterStartIssue);
export type UpdateContractInput = z.infer<typeof updateContractSchema>;

/** Bill one contract for one month. GST defaults to the contract's own rate (else 18% for INR). */
export const generateContractInvoiceSchema = z.object({
  month: contractMonthSchema,
  gstPercent: z.number().min(0).max(50).optional(),
});
export type GenerateContractInvoiceInput = z.infer<typeof generateContractInvoiceSchema>;

/**
 * Bill a client's retainers for one month on a single invoice — one line per
 * contract. Omit `contractIds` to include every active contract not yet billed.
 */
export const generateClientInvoiceSchema = z.object({
  clientId: clientIdField,
  month: contractMonthSchema,
  contractIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id')).min(1).optional(),
  gstPercent: z.number().min(0).max(50).optional(),
});
export type GenerateClientInvoiceInput = z.infer<typeof generateClientInvoiceSchema>;

export const listContractsQuerySchema = z.object({
  clientId: blank(z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id')),
  status: blank(z.nativeEnum(ContractStatus)),
});
export type ListContractsQuery = z.infer<typeof listContractsQuerySchema>;
