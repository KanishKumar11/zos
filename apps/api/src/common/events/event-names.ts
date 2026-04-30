// Centralized event name constants to avoid stringly-typed event names across services.
export const EVENT_NAMES = {
  // Payroll
  PAYROLL_CONFIRMED: 'payroll.confirmed',
  PAYROLL_PAID: 'payroll.paid',
  PAYSLIP_GENERATED: 'payroll.payslip.generated',

  // Leave
  LEAVE_REQUESTED: 'leave.requested',
  LEAVE_APPROVED: 'leave.approved',
  LEAVE_REJECTED: 'leave.rejected',

  // Tasks
  TASK_ASSIGNED: 'task.assigned',
  TASK_COMMENTED: 'task.commented',
  TASK_MENTIONED: 'task.mentioned',
  TASK_STATUS_CHANGED: 'task.status_changed',

  // SOW
  SOW_MILESTONE_RECEIVED: 'sow.milestone.received',
  SOW_BRIEF_PUBLISHED: 'sow.brief.published',

  // Invoices
  INVOICE_CREATED: 'invoice.created',
  INVOICE_OVERDUE: 'invoice.overdue',
  INVOICE_PAYMENT_LOGGED: 'invoice.payment.logged',

  // Announcements
  ANNOUNCEMENT_POSTED: 'announcement.posted',
} as const;

export type EventName = (typeof EVENT_NAMES)[keyof typeof EVENT_NAMES];
