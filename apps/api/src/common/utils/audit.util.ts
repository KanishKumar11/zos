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

/**
 * Only the top-level fields that changed between two snapshots — keeps audit entries small and
 * stops whole documents (with every price on them) being copied into the log.
 */
export function diffSnapshot(before: unknown, after: unknown): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const b = (snapshot(before) ?? {}) as Record<string, unknown>;
  const a = (snapshot(after) ?? {}) as Record<string, unknown>;
  const out = { before: {} as Record<string, unknown>, after: {} as Record<string, unknown> };
  for (const key of new Set([...Object.keys(b), ...Object.keys(a)])) {
    if (key === 'updatedAt' || key === '__v') continue;
    if (JSON.stringify(b[key]) !== JSON.stringify(a[key])) {
      out.before[key] = b[key];
      out.after[key] = a[key];
    }
  }
  return out;
}
