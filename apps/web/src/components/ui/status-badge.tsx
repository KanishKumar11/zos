// StatusBadge — one consistent, human-readable badge for every status enum in the app.
import { Badge, type BadgeProps } from './badge';

type Tone = NonNullable<BadgeProps['variant']>;

const MAP: Record<string, { label: string; tone: Tone }> = {
  // Projects
  PLANNING: { label: 'Planning', tone: 'muted' },
  ACTIVE: { label: 'Active', tone: 'success' },
  IN_PROGRESS: { label: 'In progress', tone: 'info' },
  REVIEW: { label: 'In review', tone: 'warning' },
  COMPLETED: { label: 'Completed', tone: 'outline' },
  ON_HOLD: { label: 'On hold', tone: 'warning' },
  // Invoices
  DRAFT: { label: 'Draft', tone: 'muted' },
  SENT: { label: 'Sent', tone: 'info' },
  PARTIAL: { label: 'Part paid', tone: 'warning' },
  PARTIALLY_PAID: { label: 'Part paid', tone: 'warning' },
  PAID: { label: 'Paid', tone: 'success' },
  OVERDUE: { label: 'Overdue', tone: 'danger' },
  WRITTEN_OFF: { label: 'Written off', tone: 'outline' },
  VOID: { label: 'Void', tone: 'outline' },
  // Milestones
  PENDING: { label: 'Pending', tone: 'muted' },
  INVOICED: { label: 'Invoiced', tone: 'info' },
  COLLECTED: { label: 'Collected', tone: 'success' },
  // Tasks
  BACKLOG: { label: 'Backlog', tone: 'muted' },
  TODO: { label: 'To do', tone: 'outline' },
  IN_REVIEW: { label: 'In review', tone: 'warning' },
  BLOCKED: { label: 'Blocked', tone: 'danger' },
  DONE: { label: 'Done', tone: 'success' },
  // People
  INVITED: { label: 'Invited', tone: 'info' },
  PROBATION: { label: 'Probation', tone: 'warning' },
  ON_LEAVE: { label: 'On leave', tone: 'warning' },
  SUSPENDED: { label: 'Suspended', tone: 'danger' },
  EXITED: { label: 'Exited', tone: 'outline' },
  // Contracts
  PAUSED: { label: 'Paused', tone: 'warning' },
};

export const statusLabel = (status: string | undefined): string =>
  status ? (MAP[status]?.label ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ')) : '';

export function StatusBadge({ status, className }: { status: string | undefined; className?: string }) {
  if (!status) return null;
  return (
    <Badge variant={MAP[status]?.tone ?? 'outline'} className={className}>
      {statusLabel(status)}
    </Badge>
  );
}
