// FreelancersService — the freelancer directory. Deals live on projects, payments in payouts.
import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { AuditAction, PayeeType, type FreelancerInput, type UpdateFreelancerInput } from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';
import { diffSnapshot, emitAudit, snapshot } from '@/common/utils/audit.util';

import { PayoutsService } from '../payouts/payouts.service';
import { Payout, type PayoutDocument } from '../payouts/schemas/payout.schema';
import { Project, type ProjectDocument } from '../projects/schemas/project.schema';
import { Freelancer, type FreelancerDocument } from './schemas/freelancer.schema';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class FreelancersService {
  constructor(
    @InjectModel(Freelancer.name) private readonly model: Model<FreelancerDocument>,
    @InjectModel(Project.name) private readonly projects: Model<ProjectDocument>,
    @InjectModel(Payout.name) private readonly payouts: Model<PayoutDocument>,
    private readonly payoutsSvc: PayoutsService,
    private readonly events: EventEmitter2,
  ) {}

  /** Directory with a money summary per freelancer (agreed / paid / pending across projects). */
  async list(q?: string) {
    const filter: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (q?.trim()) {
      const re = new RegExp(escapeRe(q.trim()), 'i');
      filter.$or = [{ name: re }, { email: re }, { skill: re }];
    }
    const docs = await this.model.find(filter).sort({ name: 1 }).exec();
    const ids = docs.map((d) => d._id);
    const [agreedAgg, paidAgg] = await Promise.all([
      this.projects.aggregate<{ _id: Types.ObjectId; agreedPaise: number; projects: number }>([
        { $match: { deletedAt: { $exists: false }, 'freelancers.freelancerId': { $in: ids } } },
        { $unwind: '$freelancers' },
        { $match: { 'freelancers.freelancerId': { $in: ids } } },
        {
          $group: {
            _id: '$freelancers.freelancerId',
            agreedPaise: { $sum: '$freelancers.agreedPaise' },
            projects: { $sum: 1 },
          },
        },
      ]),
      this.payouts.aggregate<{ _id: Types.ObjectId; paidPaise: number; last: Date }>([
        { $match: { deletedAt: { $exists: false }, freelancerId: { $in: ids } } },
        { $group: { _id: '$freelancerId', paidPaise: { $sum: '$amountPaise' }, last: { $max: '$paidAt' } } },
      ]),
    ]);
    const agreed = new Map(agreedAgg.map((a) => [a._id.toString(), a]));
    const paid = new Map(paidAgg.map((p) => [p._id.toString(), p]));
    return docs.map((d) => {
      const a = agreed.get(d.id);
      const p = paid.get(d.id);
      const legacyAgreed = d.legacyEngagements.reduce((s, l) => s + (l.agreedPaise ?? 0), 0);
      const agreedPaise = (a?.agreedPaise ?? 0) + legacyAgreed;
      const paidPaise = p?.paidPaise ?? 0;
      return {
        ...(d.toJSON() as Record<string, unknown>),
        projectCount: a?.projects ?? 0,
        agreedPaise,
        paidPaise,
        pendingPaise: Math.max(0, agreedPaise - paidPaise),
        lastPaidAt: p?.last,
      };
    });
  }

  async byId(id: string) {
    const doc = await this.byIdOrThrow(id);
    const balances = await this.payoutsSvc.payeeBalances(PayeeType.FREELANCER, id);
    return { ...(doc.toJSON() as Record<string, unknown>), balances };
  }

  async create(input: FreelancerInput, actorId: string) {
    const doc = await this.model.create({ ...input, email: input.email || undefined });
    emitAudit(this.events, {
      actorId,
      action: AuditAction.FREELANCER_CREATED,
      entity: 'freelancer',
      entityId: doc.id,
      summary: doc.name,
    });
    return doc;
  }

  async update(id: string, input: UpdateFreelancerInput, actorId: string) {
    const doc = await this.byIdOrThrow(id);
    const before = snapshot(doc);
    Object.assign(doc, input);
    if (input.email !== undefined) doc.email = input.email || undefined;
    await doc.save();
    emitAudit(this.events, {
      actorId,
      action: AuditAction.FREELANCER_UPDATED,
      entity: 'freelancer',
      entityId: id,
      ...diffSnapshot(before, doc),
    });
    return doc;
  }

  async remove(id: string, actorId: string) {
    const doc = await this.byIdOrThrow(id);
    doc.deletedAt = new Date();
    await doc.save();
    emitAudit(this.events, {
      actorId,
      action: AuditAction.FREELANCER_DELETED,
      entity: 'freelancer',
      entityId: id,
      summary: doc.name,
    });
    return { ok: true };
  }

  /** Attach an imported free-text agreement to a real project (and move its payments there). */
  async linkLegacy(id: string, legacyId: string, projectId: string, actorId: string) {
    const doc = await this.byIdOrThrow(id);
    const legacy = doc.legacyEngagements.find((l) => l.legacyId === legacyId);
    if (!legacy) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Agreement not found' });
    const project = await this.projects.findOne({ _id: projectId, deletedAt: { $exists: false } }).exec();
    if (!project) throw new NotFoundException({ code: ErrorCodes.PROJECT_NOT_FOUND, message: 'Project not found' });

    const existing = project.freelancers.find((f) => f.freelancerId.equals(doc._id));
    if (existing) existing.agreedPaise += legacy.agreedPaise;
    else {
      project.freelancers.push({
        freelancerId: doc._id,
        agreedPaise: legacy.agreedPaise,
        scope: '',
        addedAt: new Date(),
      } as never);
    }
    project.markModified('freelancers');
    await project.save();

    await this.payouts.updateMany(
      { legacyId: new RegExp(`^${escapeRe(legacyId)}:`), freelancerId: doc._id },
      { $set: { projectId: project._id } },
    );
    doc.legacyEngagements = doc.legacyEngagements.filter((l) => l.legacyId !== legacyId) as never;
    await doc.save();
    emitAudit(this.events, {
      actorId,
      action: AuditAction.FREELANCER_ENGAGED,
      entity: 'freelancer',
      entityId: id,
      summary: `Linked "${legacy.projectRef}" to ${project.name}`,
    });
    return this.byId(id);
  }

  private async byIdOrThrow(id: string) {
    const doc = await this.model.findOne({ _id: id, deletedAt: { $exists: false } }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Freelancer not found' });
    return doc;
  }
}
