// Stable event names emitted via EventEmitter2 across api modules.
export const EVENT_NAMES = {
  leave: {
    requested: 'leave.requested',
    approved: 'leave.approved',
    rejected: 'leave.rejected',
  },
  payroll: {
    runCreated: 'payroll.run.created',
    runFinalized: 'payroll.run.finalized',
    payslipReady: 'payroll.payslip.ready',
  },
  announcement: {
    published: 'announcement.published',
  },
  notification: {
    create: 'notification.create',
  },
  task: {
    assigned: 'task.assigned',
    statusChanged: 'task.status_changed',
  },
  invoice: {
    sent: 'invoice.sent',
    overdue: 'invoice.overdue',
    paid: 'invoice.paid',
  },
  audit: {
    write: 'audit.write',
  },
} as const;
