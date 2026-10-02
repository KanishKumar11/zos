// ProjectsService — CRUD, team, freelancer deals and milestones. Role-based field visibility is
// handled by projects.presenter.ts; money paid out lives in the payouts ledger (PayoutsService).
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { type FilterQuery, Model, Types } from 'mongoose';

import {
  AuditAction,
  ProjectMemberRole,
  Role,
  type CreateProjectInput,
  type ListProjectsQuery,
  type ProjectFreelancerInput,
  type ProjectMemberInput,
  type UpdateProjectFreelancerInput,
  type UpdateProjectInput,
} from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';
import { emitAudit, snapshot } from '@/common/utils/audit.util';
import { Paginated, paginate } from '@/common/utils/pagination.util';

import { Freelancer, type FreelancerDocument } from '../freelancers/schemas/freelancer.schema';
import { Invoice, type InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { PayoutsService } from '../payouts/payouts.service';
import { User, type UserDocument } from '../users/schemas/user.schema';
import { Project, type ProjectDocument } from './schemas/project.schema';

const OWNER_ONLY_FIELDS = ['clientId', 'clientBudgetPaise', 'agencyMarginPaise', 'currency', 'portalVisible'] as const;

interface Actor {
  sub: string;
  role: Role;
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private readonly model: Model<ProjectDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Invoice.name) private readonly invoices: Model<InvoiceDocument>,
    @InjectModel(Freelancer.name) private readonly freelancers: Model<FreelancerDocument>,
    private readonly payouts: PayoutsService,
    private readonly events: EventEmitter2,
  ) {}

  async list(q: ListProjectsQuery, viewer: Actor): Promise<Paginated<ProjectDocument>> {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const filter: FilterQuery<ProjectDocument> = { deletedAt: { $exists: false } };
    if (q.status) filter.status = q.status;
    if (q.clientId && viewer.role === Role.OWNER) filter.clientId = new Types.ObjectId(q.clientId);
    if (q.q) {
      const re = new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: re }, { code: re }];
    }
    if (viewer.role !== Role.OWNER && viewer.role !== Role.ADMIN) {
      filter['members.userId'] = new Types.ObjectId(viewer.sub);
    }
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return paginate(items, total, page, pageSize);
  }

  async byId(id: string, viewer: Actor): Promise<ProjectDocument> {
    const doc = await this.findOrThrow(id);
    if (viewer.role !== Role.OWNER && viewer.role !== Role.ADMIN) {
      const isMember = doc.members.some((m) => m.userId.toString() === viewer.sub);
      if (!isMember) throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: 'Not a project member' });
    }
    return doc;
  }

  async create(input: CreateProjectInput, actor: Actor): Promise<ProjectDocument> {
    this.assertOwnerFields(input, actor);
    const exists = await this.model.findOne({ code: input.code, deletedAt: { $exists: false } }).exec();
    if (exists) {
      throw new ConflictException({ code: ErrorCodes.CONFLICT, message: `Project code "${input.code}" is already taken` });
    }
    const doc = new this.model({
      ...input,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      clientId: input.clientId ? new Types.ObjectId(input.clientId) : undefined,
      members: this.withCreator(input.members ?? [], actor).map((m) => ({
        userId: new Types.ObjectId(m.userId),
        role: m.role,
        addedAt: new Date(),
        amountPaise: actor.role === Role.OWNER ? (m.amountPaise ?? 0) : 0,
      })),
    });
    await doc.save();
    emitAudit(this.events, { actorId: actor.sub, action: AuditAction.PROJECT_CREATED, entity: 'project', entityId: doc.id, summary: doc.name });
    return doc;
  }

  async update(id: string, input: UpdateProjectInput, actor: Actor): Promise<ProjectDocument> {
    this.assertOwnerFields(input, actor);
    const current = await this.findOrThrow(id);
    const before = snapshot(current);
    const patch: Record<string, unknown> = { ...input };
    if (input.startDate) patch.startDate = new Date(input.startDate);
    if (input.endDate) patch.endDate = new Date(input.endDate);
    if (input.clientId) patch.clientId = new Types.ObjectId(input.clientId);
    if (input.members) {
      // Keep each existing member's agreed fee — the input only carries roles.
      const byUser = new Map(current.members.map((m) => [m.userId.toString(), m]));
      patch.members = input.members.map((m) => {
        const prev = byUser.get(m.userId);
        return {
          userId: new Types.ObjectId(m.userId),
          role: m.role,
          addedAt: prev?.addedAt ?? new Date(),
          amountPaise: actor.role === Role.OWNER && m.amountPaise !== undefined ? m.amountPaise : (prev?.amountPaise ?? 0),
          payments: prev?.payments ?? [],
        };
      });
    }
    const doc = await this.model
      .findOneAndUpdate({ _id: id, deletedAt: { $exists: false } }, patch, { new: true })
      .exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.PROJECT_NOT_FOUND, message: 'Project not found' });
    emitAudit(this.events, {
      actorId: actor.sub,
      action: AuditAction.PROJECT_UPDATED,
      entity: 'project',
      entityId: id,
      before,
      after: snapshot(doc),
    });
    return doc;
  }

  private assertOwnerFields(input: Record<string, unknown>, actor: Actor): void {
    if (actor.role === Role.OWNER) return;
    for (const f of OWNER_ONLY_FIELDS) {
      if (input[f] !== undefined) {
        throw new ForbiddenException({ code: ErrorCodes.OWNER_ONLY, message: `Only the owner can set ${f}` });
      }
    }
    if (Array.isArray(input.members) && input.members.some((m: { amountPaise?: number }) => m.amountPaise !== undefined)) {
      throw new ForbiddenException({ code: ErrorCodes.OWNER_ONLY, message: 'Only the owner can set member fees' });
    }
  }

  /** Leads who create a project are added as its LEAD so they don't lose access to it. */
  private withCreator(
    members: { userId: string; role: ProjectMemberRole; amountPaise?: number }[],
    actor: Actor,
  ): { userId: string; role: ProjectMemberRole; amountPaise?: number }[] {
    if (actor.role === Role.OWNER || actor.role === Role.ADMIN) return members;
    if (members.some((m) => m.userId === actor.sub)) return members;
    return [...members, { userId: actor.sub, role: ProjectMemberRole.LEAD }];
  }

  // ── Team ─────────────────────────────────────────────────────────────────────────

  async addMember(id: string, input: ProjectMemberInput, actor: Actor): Promise<ProjectDocument> {
    if (input.amountPaise !== undefined && actor.role !== Role.OWNER) {
      throw new ForbiddenException({ code: ErrorCodes.OWNER_ONLY, message: 'Only the owner can set member fees' });
    }
    const user = await this.users.findOne({ _id: input.userId, deletedAt: { $exists: false } }).select('name').exec();
    if (!user) throw new NotFoundException({ code: ErrorCodes.MEMBER_NOT_FOUND, message: 'Team member not found' });
    const doc = await this.model
      .findOneAndUpdate(
        { _id: id, deletedAt: { $exists: false }, 'members.userId': { $ne: new Types.ObjectId(input.userId) } },
        {
          $push: {
            members: {
              userId: new Types.ObjectId(input.userId),
              role: input.role,
              addedAt: new Date(),
              amountPaise: input.amountPaise ?? 0,
            },
          },
        },
        { new: true },
      )
      .exec();
    if (!doc) {
      await this.findOrThrow(id);
      throw new ConflictException({ code: ErrorCodes.CONFLICT, message: `${user.name} is already on this project` });
    }
    if (input.amountPaise) {
      emitAudit(this.events, {
        actorId: actor.sub,
        action: AuditAction.MEMBER_FEE_SET,
        entity: 'project',
        entityId: id,
        summary: `${user.name} added to ${doc.name} with agreed fee`,
        after: { userId: input.userId, amountPaise: input.amountPaise },
      });
    }
    return doc;
  }

  async removeMember(id: string, userId: string): Promise<ProjectDocument> {
    const doc = await this.model
      .findOneAndUpdate(
        { _id: id, deletedAt: { $exists: false } },
        { $pull: { members: { userId: new Types.ObjectId(userId) } } },
        { new: true },
      )
      .exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.PROJECT_NOT_FOUND, message: 'Project not found' });
    return doc;
  }

  /** OWNER-only: agreed fee for a member on this project. */
  async setMemberCost(projectId: string, userId: string, amountPaise: number, actor: Actor): Promise<ProjectDocument> {
    const doc = await this.findOrThrow(projectId);
    const member = doc.members.find((m) => m.userId.toString() === userId);
    if (!member) throw new NotFoundException({ code: ErrorCodes.MEMBER_NOT_FOUND, message: 'Member not found on project' });
    const before = member.amountPaise;
    member.amountPaise = amountPaise;
    doc.markModified('members');
    await doc.save();
    emitAudit(this.events, {
      actorId: actor.sub,
      action: AuditAction.MEMBER_FEE_SET,
      entity: 'project',
      entityId: projectId,
      before: { userId, amountPaise: before },
      after: { userId, amountPaise },
    });
    return doc;
  }

  // ── Freelancer deals ─────────────────────────────────────────────────────────────

  async addFreelancer(projectId: string, input: ProjectFreelancerInput, actor: Actor): Promise<ProjectDocument> {
    const doc = await this.findOrThrow(projectId);
    const fl = await this.freelancers.findOne({ _id: input.freelancerId, deletedAt: { $exists: false } }).select('name').exec();
    if (!fl) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Freelancer not found' });
    if (doc.freelancers.some((f) => f.freelancerId.equals(fl._id))) {
      throw new ConflictException({ code: ErrorCodes.CONFLICT, message: `${fl.name} is already on this project` });
    }
    doc.freelancers.push({
      freelancerId: fl._id,
      agreedPaise: input.agreedPaise ?? 0,
      scope: input.scope ?? '',
      addedAt: new Date(),
    } as never);
    doc.markModified('freelancers');
    await doc.save();
    emitAudit(this.events, {
      actorId: actor.sub,
      action: AuditAction.FREELANCER_ENGAGED,
      entity: 'project',
      entityId: projectId,
      summary: `${fl.name} added to ${doc.name}`,
      after: input,
    });
    return doc;
  }

  async updateFreelancer(
    projectId: string,
    freelancerId: string,
    input: UpdateProjectFreelancerInput,
    actor: Actor,
  ): Promise<ProjectDocument> {
    const doc = await this.findOrThrow(projectId);
    const deal = doc.freelancers.find((f) => f.freelancerId.toString() === freelancerId);
    if (!deal) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Freelancer not on this project' });
    const before = { agreedPaise: deal.agreedPaise, scope: deal.scope };
    if (input.agreedPaise !== undefined) deal.agreedPaise = input.agreedPaise;
    if (input.scope !== undefined) deal.scope = input.scope;
    doc.markModified('freelancers');
    await doc.save();
    emitAudit(this.events, {
      actorId: actor.sub,
      action: AuditAction.FREELANCER_ENGAGED,
      entity: 'project',
      entityId: projectId,
      before,
      after: input,
    });
    return doc;
  }

  async removeFreelancer(projectId: string, freelancerId: string, actor: Actor): Promise<ProjectDocument> {
    const doc = await this.findOrThrow(projectId);
    doc.freelancers = doc.freelancers.filter((f) => f.freelancerId.toString() !== freelancerId) as never;
    doc.markModified('freelancers');
    await doc.save();
    emitAudit(this.events, {
      actorId: actor.sub,
      action: AuditAction.FREELANCER_ENGAGED,
      entity: 'project',
      entityId: projectId,
      summary: 'Freelancer removed from project',
      before: { freelancerId },
    });
    return doc;
  }

  async softDelete(id: string, actor: Actor): Promise<void> {
    const res = await this.model.findByIdAndUpdate(id, { deletedAt: new Date() }).exec();
    if (!res) throw new NotFoundException({ code: ErrorCodes.PROJECT_NOT_FOUND, message: 'Project not found' });
    emitAudit(this.events, { actorId: actor.sub, action: AuditAction.PROJECT_DELETED, entity: 'project', entityId: id, summary: res.name });
  }

  /**
   * Resource availability: list users with the projects they're allocated to.
   * OWNER+ADMIN+LEAD only (enforced at controller). Returns one row per user.
   */
  async availability(): Promise<
    { userId: string; projects: { projectId: string; name: string; code: string; role: string }[] }[]
  > {
    const projects = await this.model
      .find({ deletedAt: { $exists: false }, status: { $ne: 'COMPLETED' } })
      .select('name code members')
      .exec();
    const map = new Map<string, { userId: string; projects: { projectId: string; name: string; code: string; role: string }[] }>();
    for (const p of projects) {
      for (const m of p.members) {
        const uid = m.userId.toString();
        if (!map.has(uid)) map.set(uid, { userId: uid, projects: [] });
        map.get(uid)!.projects.push({ projectId: p.id, name: p.name, code: p.code, role: m.role });
      }
    }
    return [...map.values()];
  }

  // ── Milestones ───────────────────────────────────────────────────────────────────

  async addMilestone(projectId: string, input: { name: string; amountPaise: number; dueDate?: string; note?: string }) {
    const doc = await this.findOrThrow(projectId);
    (doc.milestones as unknown as Record<string, unknown>[]).push({
      name: input.name,
      amountPaise: input.amountPaise,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      note: input.note ?? '',
      status: 'PENDING',
    });
    doc.markModified('milestones');
    return doc.save();
  }

  async updateMilestone(
    projectId: string,
    milestoneId: string,
    input: { name?: string; amountPaise?: number; dueDate?: string; note?: string; status?: string; invoiceId?: string },
  ) {
    const doc = await this.findOrThrow(projectId);
    const ms = (doc.milestones as unknown as (Record<string, unknown> & { _id: Types.ObjectId })[]).find(
      (m) => m._id.toString() === milestoneId,
    );
    if (!ms) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Milestone not found' });
    if (input.name !== undefined) ms.name = input.name;
    if (input.amountPaise !== undefined) ms.amountPaise = input.amountPaise;
    if (input.dueDate !== undefined) ms.dueDate = input.dueDate ? new Date(input.dueDate) : undefined;
    if (input.note !== undefined) ms.note = input.note;
    if (input.status !== undefined) ms.status = input.status;
    if (input.invoiceId !== undefined) ms.invoiceId = new Types.ObjectId(input.invoiceId);
    doc.markModified('milestones');
    return doc.save();
  }

  async removeMilestone(projectId: string, milestoneId: string) {
    const doc = await this.findOrThrow(projectId);
    const before = doc.milestones.length;
    doc.milestones = (doc.milestones as unknown as { _id: Types.ObjectId }[]).filter(
      (m) => m._id.toString() !== milestoneId,
    ) as never;
    if (doc.milestones.length === before) throw new NotFoundException({ message: 'Milestone not found' });
    doc.markModified('milestones');
    return doc.save();
  }

  // ── Money summary (OWNER) ────────────────────────────────────────────────────────

  /**
   * Fraction of an invoice that belongs to `projectId`. Single-project invoices
   * count fully; on a multi-project invoice each project takes the share its own
   * line items represent, so a shared payment is never counted twice.
   */
  private projectShareRatio(inv: InvoiceDocument, projectId: string): number {
    const lineTotal = (li: { qty: number; unitPaise: number }) => Math.round(li.qty * li.unitPaise);
    const items = (inv.lineItems ?? []) as unknown as { qty: number; unitPaise: number; projectId?: Types.ObjectId }[];
    const tagged = items.filter((li) => li.projectId);
    if (tagged.length === 0) return inv.projectId?.toString() === projectId ? 1 : 0;
    const mine = tagged.filter((li) => li.projectId!.toString() === projectId).reduce((s, li) => s + lineTotal(li), 0);
    const subTotal = inv.subTotalPaise || items.reduce((s, li) => s + lineTotal(li), 0);
    return subTotal > 0 ? mine / subTotal : 0;
  }

  /** Collected from the client vs paid out to team and freelancers. */
  async projectBalance(projectId: string) {
    const oid = new Types.ObjectId(projectId);
    const [doc, invDocs, cost] = await Promise.all([
      this.findOrThrow(projectId),
      this.invoices
        .find({ deletedAt: { $exists: false }, $or: [{ projectId: oid }, { 'lineItems.projectId': oid }] })
        .exec(),
      this.payouts.projectCost(oid),
    ]);
    const share = (inv: InvoiceDocument) => this.projectShareRatio(inv, projectId);
    const collectedPaise = invDocs.reduce((s, inv) => {
      const paid = ((inv.payments ?? []) as unknown as { amountPaise: number }[]).reduce((ps, p) => ps + p.amountPaise, 0);
      return paid === 0 ? s : s + Math.round(paid * share(inv));
    }, 0);
    const invoicedPaise = invDocs
      .filter((inv) => inv.status !== 'DRAFT' && inv.status !== 'WRITTEN_OFF')
      .reduce((s, inv) => s + Math.round((inv.subTotalPaise ?? 0) * share(inv)), 0);
    const teamAgreedPaise = doc.members.reduce((s, m) => s + (m.amountPaise ?? 0), 0);
    const freelancerAgreedPaise = (doc.freelancers ?? []).reduce((s, f) => s + (f.agreedPaise ?? 0), 0);
    const disbursedPaise = cost.teamPaise + cost.freelancerPaise;
    return {
      budgetPaise: doc.clientBudgetPaise ?? 0,
      invoicedPaise,
      collectedPaise,
      teamAgreedPaise,
      freelancerAgreedPaise,
      teamPaidPaise: cost.teamPaise,
      freelancerPaidPaise: cost.freelancerPaise,
      disbursedPaise,
      inHandPaise: collectedPaise - disbursedPaise,
      /** Budget minus everything agreed with team and freelancers. */
      plannedMarginPaise: (doc.clientBudgetPaise ?? 0) - teamAgreedPaise - freelancerAgreedPaise,
    };
  }

  /** Display names for a project's people (colleagues may always see each other's names). */
  async peopleNames(doc: ProjectDocument): Promise<{ users: Map<string, string>; freelancers: Map<string, string> }> {
    const [users, fls] = await Promise.all([
      this.users.find({ _id: { $in: doc.members.map((m) => m.userId) } }).select('name').exec(),
      doc.freelancers?.length
        ? this.freelancers.find({ _id: { $in: doc.freelancers.map((f) => f.freelancerId) } }).select('name').exec()
        : [],
    ]);
    return {
      users: new Map(users.map((u) => [u.id as string, u.name])),
      freelancers: new Map(fls.map((f) => [f.id as string, f.name])),
    };
  }

  private async findOrThrow(id: string): Promise<ProjectDocument> {
    const doc = await this.model.findOne({ _id: id, deletedAt: { $exists: false } }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.PROJECT_NOT_FOUND, message: 'Project not found' });
    return doc;
  }
}
