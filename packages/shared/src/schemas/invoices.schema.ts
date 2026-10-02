// Invoice Zod schemas.
import { z } from 'zod';

import { InvoiceStatus } from '../enums';
import { isoDateSchema, objectIdSchema, optionalObjectIdSchema } from './common.schema';

/**
 * A line item may carry its own project (and optionally the milestone it bills),
 * so a single invoice can span several projects while each project keeps its
 * revenue attribution. `projectId` on the invoice itself stays supported for
 * single-project invoices. `contractId` works the same way for retainers, so one
 * client's contracts can be billed together on a single invoice.
 */
export const invoiceLineItemSchema = z
  .object({
    description: z.string().min(1).max(500),
    qty: z.number().positive(),
    unitPaise: z.number().int().min(0),
    projectId: optionalObjectIdSchema,
    milestoneId: optionalObjectIdSchema,
    contractId: optionalObjectIdSchema,
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

/** How a client paid an invoice. Older records may hold free text — show it as-is. */
export const INVOICE_PAYMENT_METHODS = ['BANK_TRANSFER', 'UPI', 'CASH', 'CARD', 'CHEQUE', 'OTHER'] as const;
export type InvoicePaymentMethod = (typeof INVOICE_PAYMENT_METHODS)[number];
export const INVOICE_PAYMENT_METHOD_LABEL: Record<InvoicePaymentMethod, string> = {
  BANK_TRANSFER: 'Bank transfer',
  UPI: 'UPI',
  CASH: 'Cash',
  CARD: 'Card',
  CHEQUE: 'Cheque',
  OTHER: 'Other',
};
/** Label for a stored payment method, falling back to the raw (legacy free-text) value. */
export const invoicePaymentMethodLabel = (method: string | undefined | null): string =>
  method ? (INVOICE_PAYMENT_METHOD_LABEL[method as InvoicePaymentMethod] ?? method) : '';

export const recordPaymentSchema = z.object({
  paidAt: isoDateSchema,
  amountPaise: z.number({ invalid_type_error: 'Enter an amount' }).int().min(1, 'Enter an amount'),
  reference: z.string().max(120).optional(),
  method: z.enum(INVOICE_PAYMENT_METHODS).optional(),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const writeOffInvoiceSchema = z.object({
  reason: z.string().trim().min(3, 'Add a short reason').max(500),
});
export type WriteOffInvoiceInput = z.infer<typeof writeOffInvoiceSchema>;

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd');

/**
 * Invoice list filters. `status` also accepts `open` (sent + part paid + overdue) and
 * `overdue` (any open invoice with a balance whose due date has passed — including part-paid).
 * Without `page` the API returns every match as a plain array (used by pickers and summaries).
 */
export const INVOICE_LIST_SORTS = [
  'issueDate:desc',
  'issueDate:asc',
  'dueDate:asc',
  'dueDate:desc',
  'total:desc',
  'total:asc',
  'balance:desc',
  'balance:asc',
  'number:desc',
  'number:asc',
] as const;
export const listInvoicesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(500).optional(),
  status: z.union([z.nativeEnum(InvoiceStatus), z.enum(['open', 'overdue'])]).optional(),
  clientId: objectIdSchema.optional(),
  projectId: objectIdSchema.optional(),
  contractId: objectIdSchema.optional(),
  from: ymd.optional(),
  to: ymd.optional(),
  q: z.string().max(120).optional(),
  sort: z.enum(INVOICE_LIST_SORTS).optional(),
});
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
