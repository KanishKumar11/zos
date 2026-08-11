// Invoice Zod schemas.
import { z } from 'zod';

import { InvoiceStatus } from '../enums';
import { isoDateSchema, objectIdSchema, optionalObjectIdSchema } from './common.schema';

/**
 * A line item may carry its own project (and optionally the milestone it bills),
 * so a single invoice can span several projects while each project keeps its
 * revenue attribution. `projectId` on the invoice itself stays supported for
 * single-project invoices.
 */
export const invoiceLineItemSchema = z
  .object({
    description: z.string().min(1).max(500),
    qty: z.number().positive(),
    unitPaise: z.number().int().min(0),
    projectId: optionalObjectIdSchema,
    milestoneId: optionalObjectIdSchema,
  })
  .refine((v) => !v.milestoneId || !!v.projectId, {
    message: 'milestoneId requires projectId',
    path: ['projectId'],
  });
export type InvoiceLineItemInput = z.infer<typeof invoiceLineItemSchema>;

export const createInvoiceSchema = z.object({
  number: z.string().min(2).max(40).optional(),
  clientId: objectIdSchema,
  projectId: optionalObjectIdSchema,
  contractId: optionalObjectIdSchema,
  lineItems: z.array(invoiceLineItemSchema).min(1),
  gstPercent: z.number().min(0).max(50).optional(),
  currency: z.string().length(3).optional(),
  issueDate: isoDateSchema.optional(),
  dueDate: isoDateSchema.optional(),
  notes: z.string().max(20_000).optional(),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const updateInvoiceSchema = createInvoiceSchema
  .omit({ number: true })
  .partial()
  .extend({ status: z.nativeEnum(InvoiceStatus).optional() })
  .refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' });
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

export const recordPaymentSchema = z.object({
  paidAt: isoDateSchema,
  amountPaise: z.number().int().min(1),
  reference: z.string().max(120).optional(),
  method: z.string().max(80).optional(),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
