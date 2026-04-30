// Payroll event payload types.
export interface PayrollConfirmedEvent {
  runId: string;
  month: number;
  year: number;
  userIds: string[];
}

export interface PayrollPaidEvent {
  runId: string;
  paidAt: Date;
  reference?: string;
}

export interface PayslipGeneratedEvent {
  payslipId: string;
  userId: string;
  runId: string;
  pdfKey: string;
}
