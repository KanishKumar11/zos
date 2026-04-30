// [SHARED] Lifecycle of a payroll run.
export enum PayrollStatus {
  DRAFT = 'DRAFT',
  PROCESSING = 'PROCESSING',
  CONFIRMED = 'CONFIRMED',
  FINALIZED = 'FINALIZED',
  PAID = 'PAID',
}
