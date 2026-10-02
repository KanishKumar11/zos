// emitAudit — services record meaningful audit entries (entity, id, before/after) through the
// event bus; AuditService persists them. Fire-and-forget: a failed audit write never fails the
// user's action.
import type { EventEmitter2 } from '@nestjs/event-emitter';

import { EVENT_NAMES, type AuditAction } from '@agency/shared';

export interface AuditEvent {
  actorId?: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  /** Short human summary, e.g. "₹12,000 to Priya for Website revamp". */
  summary?: string;
  before?: unknown;
  after?: unknown;
}

export function emitAudit(events: EventEmitter2, e: AuditEvent): void {
  events.emit(EVENT_NAMES.audit.write, {
    ...e,
    after: e.summary ? { summary: e.summary, ...(e.after as object | undefined) } : e.after,
  });
}

/** Plain JSON of a mongoose doc (or passthrough) for before/after snapshots. */
export const snapshot = (doc: unknown): unknown =>
  doc && typeof (doc as { toJSON?: unknown }).toJSON === 'function' ? (doc as { toJSON: () => unknown }).toJSON() : doc;
