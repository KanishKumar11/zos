// [SHARED] Lifecycle status of an invoice.
export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  PARTIAL = 'PARTIAL',
  /** @deprecated Legacy duplicate of PARTIAL — never set by the API, kept for old records. Treat as PARTIAL. */
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  WRITTEN_OFF = 'WRITTEN_OFF',
}

/** Issued invoices that still expect money (PARTIALLY_PAID counted with PARTIAL). */
export const OPEN_INVOICE_STATUSES: readonly InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIAL,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
];

/** Once an invoice reaches one of these, its client, line items, amounts and GST are locked. */
export const ISSUED_INVOICE_STATUSES: readonly InvoiceStatus[] = [
  ...OPEN_INVOICE_STATUSES,
  InvoiceStatus.PAID,
  InvoiceStatus.WRITTEN_OFF,
];
