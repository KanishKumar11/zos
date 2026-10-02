// Projects presenter — the ONLY place that decides which project fields a viewer may see.
// OWNER gets the full document. Everyone else gets the work view: no client, budget, margin or
// milestone billing amounts, and no one's pay except their own (as `myEngagement`).
import type { Paginated } from '@/common/utils/pagination.util';
import { Role } from '@agency/shared';

import type { ProjectDocument } from './schemas/project.schema';

export interface ProjectViewer {
  sub: string;
  role: Role;
}

type Plain = Record<string, any>;

const toPlain = (doc: ProjectDocument | Plain): Plain =>
  typeof (doc as ProjectDocument).toJSON === 'function'
    ? (doc as ProjectDocument).toJSON()
    : (doc as Plain);

/** What the viewer has been paid on this project, from the payouts ledger. */
export interface PaidOnProject {
  paidPaise: number;
  payments: { _id: string; paidAt: Date | string; amountPaise: number; note?: string; method?: string; reference?: string }[];
}

export function presentProject(doc: ProjectDocument | Plain, viewer: ProjectViewer, paid?: PaidOnProject): Plain {
  const p = toPlain(doc);
  if (viewer.role === Role.OWNER) return p;

  const members: Plain[] = p.members ?? [];
  const mine = members.find((m) => String(m.userId) === viewer.sub);
  const agreed = mine?.amountPaise ?? 0;
  const myPaid = paid?.paidPaise ?? 0;

  return {
    _id: p._id,
    name: p.name,
    code: p.code,
    description: p.description,
    status: p.status,
    startDate: p.startDate,
    endDate: p.endDate,
    brief: p.brief,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    members: members.map((m) => ({ userId: m.userId, role: m.role, addedAt: m.addedAt })),
    milestones: (p.milestones ?? []).map((ms: Plain) => ({
      _id: ms._id,
      name: ms.name,
      dueDate: ms.dueDate,
      status: ms.status,
    })),
    myEngagement: mine
      ? {
          agreedPaise: agreed,
          paidPaise: myPaid,
          pendingPaise: Math.max(0, agreed - myPaid),
          currency: p.currency ?? 'INR',
          payments: paid?.payments ?? [],
        }
      : null,
  };
}

export function presentProjects(
  page: Paginated<ProjectDocument>,
  viewer: ProjectViewer,
  paidByProject?: Map<string, PaidOnProject>,
): Paginated<Plain> {
  return {
    ...page,
    items: page.items.map((d) => presentProject(d, viewer, paidByProject?.get(String(d._id)))),
  };
}
