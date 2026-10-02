// ClientsService — OWNER-only. Includes per-client money/work summaries for the client 360 view.
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { AuditAction, InvoiceStatus, Role, type CreateClientInput, type UpdateClientInput } from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';
import { emitAudit, snapshot } from '@/common/utils/audit.util';

import { Contract, type ContractDocument } from '../contracts/schemas/contract.schema';
import { Invoice, type InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { Project, type ProjectDocument } from '../projects/schemas/project.schema';
import { User, type UserDocument } from '../users/schemas/user.schema';
import { Client, type ClientDocument } from './schemas/client.schema';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface ClientStats {
  activeProjects: number;
  totalProjects: number;
  invoicedPaise: number;
  collectedPaise: number;
  outstandingPaise: number;
  overduePaise: number;
  lastPaymentAt?: Date;
  activeContracts: number;
  portalUsers: number;
}

@Injectable()
export class ClientsService {
  constructor(
    @InjectModel(Client.name) private readonly model: Model<ClientDocument>,
    @InjectModel(Project.name) private readonly projects: Model<ProjectDocument>,
    @InjectModel(Invoice.name) private readonly invoices: Model<InvoiceDocument>,
    @InjectModel(Contract.name) private readonly contracts: Model<ContractDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly events: EventEmitter2,
  ) {}

  list(search?: string): Promise<ClientDocument[]> {
    const filter: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (search?.trim()) {
      const re = new RegExp(escapeRe(search.trim()), 'i');
      filter.$or = [{ name: re }, { gstin: re }, { 'contacts.name': re }, { 'contacts.email': re }, { billingEmail: re }];
    }
    return this.model.find(filter).sort({ name: 1 }).limit(1000).exec();
  }

  /** Money + work totals for every client (or the given ones), keyed by client id. */
  async stats(clientIds?: Types.ObjectId[]): Promise<Record<string, ClientStats>> {
    const match = clientIds ? { clientId: { $in: clientIds } } : { clientId: { $exists: true } };
    const now = new Date();
    const [inv, proj, contracts, portal] = await Promise.all([
      this.invoices.aggregate<{
        _id: Types.ObjectId;
        invoiced: number;
        collected: number;
        outstanding: number;
        overdue: number;
        lastPayment: Date;
      }>([
        { $match: { ...match, deletedAt: { $exists: false }, status: { $nin: [InvoiceStatus.DRAFT, InvoiceStatus.WRITTEN_OFF] } } },
        {
          $group: {
            _id: '$clientId',
            invoiced: { $sum: '$totalPaise' },
            collected: { $sum: '$paidPaise' },
            outstanding: { $sum: { $max: [0, { $subtract: ['$totalPaise', '$paidPaise'] }] } },
            overdue: {
              $sum: {
                $cond: [
                  { $and: [{ $lt: ['$dueDate', now] }, { $gt: [{ $subtract: ['$totalPaise', '$paidPaise'] }, 0] }] },
                  { $subtract: ['$totalPaise', '$paidPaise'] },
                  0,
                ],
              },
            },
            lastPayment: { $max: { $max: '$payments.paidAt' } },
          },
        },
      ]),
      this.projects.aggregate<{ _id: Types.ObjectId; total: number; active: number }>([
        { $match: { ...match, deletedAt: { $exists: false } } },
        { $group: { _id: '$clientId', total: { $sum: 1 }, active: { $sum: { $cond: [{ $ne: ['$status', 'COMPLETED'] }, 1, 0] } } } },
      ]),
      this.contracts.aggregate<{ _id: Types.ObjectId; active: number }>([
        { $match: { ...match, deletedAt: { $exists: false }, status: 'ACTIVE' } },
        { $group: { _id: '$clientId', active: { $sum: 1 } } },
      ]),
      this.users.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { ...match, role: Role.CLIENT, deletedAt: { $exists: false }, status: 'ACTIVE' } },
        { $group: { _id: '$clientId', count: { $sum: 1 } } },
      ]),
    ]);
    const out: Record<string, ClientStats> = {};
    const get = (id: Types.ObjectId) =>
      (out[id.toString()] ??= {
        activeProjects: 0,
        totalProjects: 0,
        invoicedPaise: 0,
        collectedPaise: 0,
        outstandingPaise: 0,
        overduePaise: 0,
        activeContracts: 0,
        portalUsers: 0,
      });
    for (const r of inv) Object.assign(get(r._id), { invoicedPaise: r.invoiced, collectedPaise: r.collected, outstandingPaise: r.outstanding, overduePaise: r.overdue, lastPaymentAt: r.lastPayment });
    for (const r of proj) Object.assign(get(r._id), { totalProjects: r.total, activeProjects: r.active });
    for (const r of contracts) get(r._id).activeContracts = r.active;
    for (const r of portal) get(r._id).portalUsers = r.count;
    return out;
  }

  async byId(id: string): Promise<ClientDocument> {
    const doc = await this.model.findOne({ _id: id, deletedAt: { $exists: false } }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.CLIENT_NOT_FOUND, message: 'Client not found' });
    return doc;
  }

  async create(input: CreateClientInput, actorId?: string): Promise<ClientDocument> {
    const dup = await this.model
      .findOne({ name: new RegExp(`^${escapeRe(input.name.trim())}$`, 'i'), deletedAt: { $exists: false } })
      .exec();
    if (dup) throw new ConflictException({ code: ErrorCodes.CONFLICT, message: `A client called "${dup.name}" already exists` });
    const doc = await this.model.create(input);
    emitAudit(this.events, { actorId, action: AuditAction.CLIENT_CREATED, entity: 'client', entityId: doc.id, summary: doc.name });
    return doc;
  }

  async update(id: string, input: UpdateClientInput, actorId?: string): Promise<ClientDocument> {
    const before = snapshot(await this.byId(id));
    const doc = await this.model.findOneAndUpdate({ _id: id, deletedAt: { $exists: false } }, input, { new: true }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.CLIENT_NOT_FOUND, message: 'Client not found' });
    emitAudit(this.events, { actorId, action: AuditAction.CLIENT_UPDATED, entity: 'client', entityId: id, before, after: snapshot(doc) });
    return doc;
  }

  /** Refuses while the client still has projects or invoices, so nothing is left pointing at a missing client. */
  async remove(id: string, actorId?: string): Promise<void> {
    const doc = await this.byId(id);
    const oid = new Types.ObjectId(id);
    const [projects, invoices] = await Promise.all([
      this.projects.countDocuments({ clientId: oid, deletedAt: { $exists: false } }),
      this.invoices.countDocuments({ clientId: oid, deletedAt: { $exists: false } }),
    ]);
    if (projects || invoices) {
      const parts = [projects ? `${projects} project${projects === 1 ? '' : 's'}` : '', invoices ? `${invoices} invoice${invoices === 1 ? '' : 's'}` : '']
        .filter(Boolean)
        .join(' and ');
      throw new ConflictException({
        code: ErrorCodes.CONFLICT,
        message: `${doc.name} still has ${parts}. Delete or move those first — or keep the client.`,
      });
    }
    doc.deletedAt = new Date();
    await doc.save();
    // Portal users of a deleted client lose access.
    await this.users.updateMany({ role: Role.CLIENT, clientId: oid }, { $set: { status: 'SUSPENDED' }, $inc: { tokenVersion: 1 } });
    emitAudit(this.events, { actorId, action: AuditAction.CLIENT_DELETED, entity: 'client', entityId: id, summary: doc.name });
  }
}
