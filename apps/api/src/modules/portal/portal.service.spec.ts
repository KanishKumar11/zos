import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import { InvoiceStatus, ProjectMemberRole, Role } from '@agency/shared';

import { PortalService } from './portal.service';

/** Minimal chainable query stub: .select()/.sort()/.limit() return itself, .exec() resolves. */
const query = <T>(result: T) => {
  const q = { select: () => q, sort: () => q, limit: () => q, exec: async () => result };
  return q;
};

const CLIENT_A = new Types.ObjectId().toString();
const CLIENT_B = new Types.ObjectId().toString();

function makeService(opts: { userClientId?: string | null; invoiceOwner?: string } = {}) {
  const findOneCalls: Record<string, unknown>[] = [];
  const users = {
    findOne: () =>
      query(opts.userClientId === null ? null : { clientId: new Types.ObjectId(opts.userClientId ?? CLIENT_A) }),
  };
  const invoices = {
    findOne: (filter: Record<string, unknown>) => {
      findOneCalls.push(filter);
      // Simulate Mongo: only match when the filter's clientId equals the invoice owner.
      const owner = opts.invoiceOwner ?? CLIENT_A;
      const matches = String(filter.clientId) === owner;
      return query(matches ? { id: 'inv1', toJSON: () => ({}) } : null);
    },
  };
  const svc = new PortalService(
    users as never,
    {} as never,
    {} as never,
    invoices as never,
    {} as never,
    { invoicePdf: async () => ({ buffer: Buffer.from(''), filename: 'x.pdf' }) } as never,
  );
  return { svc, findOneCalls };
}

describe('PortalService scoping', () => {
  it('resolves the client from the database, not the token', async () => {
    const { svc } = makeService({ userClientId: CLIENT_A });
    await expect(svc.clientIdFor('user1')).resolves.toBe(CLIENT_A);
  });

  it('rejects portal users who are not linked to a client', async () => {
    const { svc } = makeService({ userClientId: null });
    await expect(svc.clientIdFor('user1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("never returns another client's invoice", async () => {
    const { svc, findOneCalls } = makeService({ invoiceOwner: CLIENT_B });
    await expect(svc.invoicePdf(CLIENT_A, new Types.ObjectId().toString())).rejects.toBeInstanceOf(NotFoundException);
    // The lookup is always scoped to the caller's client and hides drafts.
    expect(String(findOneCalls[0]!.clientId)).toBe(CLIENT_A);
    expect(findOneCalls[0]!.status).toEqual({ $ne: InvoiceStatus.DRAFT });
  });

  it('serves the PDF when the invoice belongs to the caller', async () => {
    const { svc } = makeService({ invoiceOwner: CLIENT_A });
    await expect(svc.invoicePdf(CLIENT_A, new Types.ObjectId().toString())).resolves.toHaveProperty('filename');
  });

  it('only accepts CLIENT-role users in clientIdFor', async () => {
    const seen: Record<string, unknown>[] = [];
    const users = {
      findOne: (f: Record<string, unknown>) => {
        seen.push(f);
        return query({ clientId: new Types.ObjectId(CLIENT_A) });
      },
    };
    const svc = new PortalService(users as never, {} as never, {} as never, {} as never, {} as never, {} as never);
    await svc.clientIdFor('user1');
    expect(seen[0]!.role).toBe(Role.CLIENT);
  });
});

describe('PortalService project data', () => {
  const LEAD = new Types.ObjectId();
  const MEMBER = new Types.ObjectId();
  const projectDoc = (clientId: string) => ({
    _id: new Types.ObjectId(),
    id: 'p1',
    name: 'Website',
    code: 'WEB',
    status: 'ACTIVE',
    currency: 'INR',
    clientId: new Types.ObjectId(clientId),
    members: [
      { userId: LEAD, role: ProjectMemberRole.LEAD, amountPaise: 5_000_000 },
      { userId: MEMBER, role: ProjectMemberRole.CONTRIBUTOR, amountPaise: 2_000_000 },
    ],
    milestones: [{ _id: new Types.ObjectId(), name: 'Design', amountPaise: 100_000, status: 'PENDING' }],
  });
  const people = [
    { id: LEAD.toString(), name: 'Lena Lead', email: 'lena@agency.test', title: 'Design lead', amountPaise: 1 },
    { id: MEMBER.toString(), name: 'Max Member', email: 'max@agency.test' },
  ];

  function makeProjectService(owner = CLIENT_A) {
    const projectFilters: Record<string, unknown>[] = [];
    const collabCalls: string[][] = [];
    const users = { find: () => query(people) };
    const projects = {
      find: (f: Record<string, unknown>) => {
        projectFilters.push(f);
        return query(String(f.clientId) === owner ? [projectDoc(owner)] : []);
      },
      findOne: (f: Record<string, unknown>) => {
        projectFilters.push(f);
        return query(String(f.clientId) === owner ? projectDoc(owner) : null);
      },
    };
    const invoices = { find: () => query([]) };
    const collab = {
      projectForClient: async (projectId: string, clientId: string) => {
        collabCalls.push([projectId, clientId]);
        if (clientId !== owner) throw new NotFoundException();
        return projectDoc(owner);
      },
      listUpdates: async () => [],
      listFiles: async () => [],
    };
    const svc = new PortalService(users as never, {} as never, projects as never, invoices as never, collab as never, {} as never);
    return { svc, projectFilters, collabCalls };
  }

  it('lists only the caller client’s visible projects, with the lead contact and no amounts', async () => {
    const { svc, projectFilters } = makeProjectService();
    const list = await svc.projects(CLIENT_A);
    expect(String(projectFilters[0]!.clientId)).toBe(CLIENT_A);
    expect(projectFilters[0]!.portalVisible).toEqual({ $ne: false });
    expect(list[0]!.lead).toEqual({ name: 'Lena Lead', email: 'lena@agency.test', title: 'Design lead' });
    expect(list[0]!.milestones[0]).not.toHaveProperty('amountPaise');
    await expect(svc.projects(CLIENT_B)).resolves.toEqual([]);
  });

  it('shows the project team by name only — no ids, no pay', async () => {
    const { svc, collabCalls } = makeProjectService();
    const p = await svc.project(CLIENT_A, 'p1');
    expect(collabCalls[0]).toEqual(['p1', CLIENT_A]);
    expect(p.team).toEqual([
      { name: 'Lena Lead', title: 'Design lead', lead: true },
      { name: 'Max Member', title: undefined, lead: false },
    ]);
    const json = JSON.stringify(p.team);
    expect(json).not.toContain('amountPaise');
    expect(json).not.toContain(LEAD.toString());
  });

  it("never opens another client's project, even for the owner preview", async () => {
    const { svc, projectFilters } = makeProjectService(CLIENT_B);
    await expect(svc.project(CLIENT_A, 'p1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.project(CLIENT_A, 'p1', { includeHidden: true })).rejects.toBeInstanceOf(NotFoundException);
    expect(String(projectFilters[0]!.clientId)).toBe(CLIENT_A);
    expect(projectFilters[0]!.deletedAt).toEqual({ $exists: false });
  });
});
