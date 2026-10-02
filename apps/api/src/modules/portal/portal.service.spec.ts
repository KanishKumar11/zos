import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import { InvoiceStatus, Role } from '@agency/shared';

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
