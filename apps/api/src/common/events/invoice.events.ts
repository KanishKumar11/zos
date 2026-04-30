// Invoice event payload types.
export interface InvoiceCreatedEvent {
  invoiceId: string;
  clientId: string;
  amount: number;
}

export interface InvoiceOverdueEvent {
  invoiceId: string;
  clientId: string;
  dueDate: Date;
}

export interface InvoicePaymentLoggedEvent {
  invoiceId: string;
  amount: number;
  paidAt: Date;
}
