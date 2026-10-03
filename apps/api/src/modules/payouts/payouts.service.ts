// PayoutsService — the ledger of money paid out to team members and freelancers.
//
// Agreed fees live on the project (members[].amountPaise, freelancers[].agreedPaise); every
// payment against them is a Payout. Balances = agreed − sum(payouts) per person per project.
import { BadRequestException, Injectable, Logger, NotFoundException, type OnApplicationBootstrap } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { type FilterQuery, Model, Types } from 'mongoose';

import {
  AuditAction,
  EVENT_NAMES,
  NotificationType,
  PayeeType,
  PayoutCategory,
  PayoutMethod,
  type CreatePayoutParsed,
  type ListPayoutsQuery,
  type UpdatePayoutInput,
  Role,
} from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';
import { emitAudit, snapshot } from '@/common/utils/audit.util';

import { FreelancerPayment, type FreelancerPaymentDocument } from '../freelancer-payments/schemas/freelancer-payment.schema';
import { Freelancer, type FreelancerDocument } from '../freelancers/schemas/freelancer.schema';
import { Project, type ProjectDocument } from '../projects/schemas/project.schema';
import { User, type UserDocument } from '../users/schemas/user.schema';
import { Payout, type PayoutDocument } from './schemas/payout.schema';

/** Dates arrive as yyyy-mm-dd; store at 12:00 UTC so the calendar day is the same in every timezone. */
export const dayToDate = (ymd: string): Date => new Date(`${ymd.slice(0, 10)}T12:00:00.000Z`);
const dayStart = (ymd: string) => new Date(`${ymd.slice(0, 10)}T00:00:00.000Z`);
const dayEnd = (ymd: string) => new Date(`${ymd.slice(0, 10)}T23:59:59.999Z`);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const inr = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100);

export interface PayoutView {
  _id: string;
  payeeType: PayeeType;
  userId?: string;
  freelancerId?: string;
  payeeName: string;
  projectId?: string;
  projectName?: string;
  projectCode?: string;
  amountPaise: number;
  currency: string;
  paidAt: Date;
  method: PayoutMethod;
  reference: string;
  category: PayoutCategory;
  note: string;
  createdAt?: Date;
}

export interface BalanceRow {
  payeeType: PayeeType;
  payeeId: string;
  payeeName: string;
  projectId: string | null;
  projectName: string;
  projectCode?: string;
  projectStatus?: string;
  agreedPaise: number;
  paidPaise: number;
  pendingPaise: number;
  lastPaidAt?: Date;
  payoutCount: number;
}

interface Actor {
  sub: string;
}

@Injectable()
export class PayoutsService implements OnApplicationBootstrap {
  private readonly log = new Logger(PayoutsService.name);
  private importRun: Promise<void> | null = null;
  private importCheckedAt = 0;

  constructor(
    @InjectModel(Payout.name) private readonly model: Model<PayoutDocument>,
    @InjectModel(Project.name) private readonly projects: Model<ProjectDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Freelancer.name) private readonly freelancers: Model<FreelancerDocument>,
    @InjectModel(FreelancerPayment.name) private readonly legacyFreelancer: Model<FreelancerPaymentDocument>,
    private readonly events: EventEmitter2,
  ) {}

  // ── Create / update / delete ─────────────────────────────────────────────────────

  async create(input: CreatePayoutParsed, actor: Actor): Promise<PayoutView & { overAgreed: boolean; agreedPaise: number; paidPaise: number }> {
    const payee = await this.resolvePayee(input.payeeType, input.userId, input.freelancerId);
    let project: ProjectDocument | null = null;
    if (input.projectId) {
      project = await this.projects.findOne({ _id: input.projectId, deletedAt: { $exists: false } }).exec();
      if (!project) throw new NotFoundException({ code: ErrorCodes.PROJECT_NOT_FOUND, message: 'Project not found' });
      if (!this.isOnProject(project, input.payeeType, payee.id)) {
        throw new BadRequestException({
          code: 'NOT_ON_PROJECT',
          message: `${payee.name} isn't on ${project.name} yet. Add them to the project first.`,
        });
      }
    }

    const doc = await this.model.create({
      payeeType: input.payeeType,
      userId: input.payeeType === PayeeType.MEMBER ? new Types.ObjectId(payee.id) : undefined,
      freelancerId: input.payeeType === PayeeType.FREELANCER ? new Types.ObjectId(payee.id) : undefined,
      projectId: project?._id,
      amountPaise: input.amountPaise,
      currency: input.currency ?? 'INR',
      paidAt: dayToDate(input.paidAt),
      method: input.method,
      reference: input.reference?.trim() ?? '',
      category: input.category,
      note: input.note?.trim() ?? '',
      createdBy: new Types.ObjectId(actor.sub),
    });

    const summary = `${inr(doc.amountPaise)} to ${payee.name}${project ? ` for ${project.name}` : ''}`;
    emitAudit(this.events, {
      actorId: actor.sub,
      action: AuditAction.PAYMENT_LOGGED,
      entity: 'payout',
      entityId: doc.id,
      summary,
    });

    if (input.payeeType === PayeeType.MEMBER) {
      this.events.emit(EVENT_NAMES.notification.create, {
        userId: payee.id,
        type: NotificationType.PAYMENT_RECEIVED,
        title: `Payment of ${inr(doc.amountPaise)} sent`,
        body: project ? `For ${project.name}.${doc.reference ? ` Ref: ${doc.reference}` : ''}` : doc.note || undefined,
        linkPath: '/earnings',
        data: { payoutId: doc.id, projectId: project?.id },
      });
    }

    const [view] = await this.present([doc]);
    const balance = project ? await this.balanceFor(project, input.payeeType, payee.id) : { agreedPaise: 0, paidPaise: 0 };
    return {
      ...view!,
      ...balance,
      overAgreed: balance.agreedPaise > 0 && balance.paidPaise > balance.agreedPaise,
    };
  }

  async update(id: string, input: UpdatePayoutInput, actor: Actor): Promise<PayoutView> {
    const doc = await this.byIdOrThrow(id);
    const before = snapshot(doc);
    if (input.projectId !== undefined) {
      if (!input.projectId) {
        doc.projectId = undefined;
      } else {
        const project = await this.projects.findOne({ _id: input.projectId, deletedAt: { $exists: false } }).exec();
        if (!project) throw new NotFoundException({ code: ErrorCodes.PROJECT_NOT_FOUND, message: 'Project not found' });
        const payeeId = (doc.userId ?? doc.freelancerId)!.toString();
        if (!this.isOnProject(project, doc.payeeType, payeeId)) {
          throw new BadRequestException({ code: 'NOT_ON_PROJECT', message: `This person isn't on ${project.name}.` });
        }
        doc.projectId = project._id;
      }
    }
    if (input.amountPaise !== undefined) doc.amountPaise = input.amountPaise;
    if (input.paidAt !== undefined) doc.paidAt = dayToDate(input.paidAt);
    if (input.method !== undefined) doc.method = input.method;
    if (input.reference !== undefined) doc.reference = input.reference.trim();
    if (input.category !== undefined) doc.category = input.category;
    if (input.note !== undefined) doc.note = input.note.trim();
    await doc.save();
    emitAudit(this.events, {
      actorId: actor.sub,
      action: AuditAction.PAYMENT_UPDATED,
      entity: 'payout',
      entityId: doc.id,
      before,
      after: snapshot(doc),
    });
    const [view] = await this.present([doc]);
    return view!;
  }

  async remove(id: string, actor: Actor): Promise<{ ok: true }> {
    const doc = await this.byIdOrThrow(id);
    doc.deletedAt = new Date();
    await doc.save();
    const [view] = await this.present([doc]);
    emitAudit(this.events, {
      actorId: actor.sub,
      action: AuditAction.PAYMENT_DELETED,
      entity: 'payout',
      entityId: doc.id,
      summary: `${inr(doc.amountPaise)} to ${view?.payeeName ?? 'unknown'}${view?.projectName ? ` for ${view.projectName}` : ''}`,
      before: snapshot(doc),
    });
    return { ok: true };
  }

  async byId(id: string): Promise<PayoutView> {
    const [view] = await this.present([await this.byIdOrThrow(id)]);
    return view!;
  }

  // ── Ledger list ──────────────────────────────────────────────────────────────────

  async list(q: ListPayoutsQuery) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 25;
    const filter = await this.buildFilter(q);
    const sort: Record<string, 1 | -1> =
      q.sort === 'paidAt:asc'
        ? { paidAt: 1, _id: 1 }
        : q.sort === 'amount:desc'
          ? { amountPaise: -1, paidAt: -1 }
          : q.sort === 'amount:asc'
            ? { amountPaise: 1, paidAt: -1 }
            : { paidAt: -1, _id: -1 };

    const [docs, total, sums] = await Promise.all([
      this.model.find(filter).sort(sort).skip((page - 1) * pageSize).limit(pageSize).exec(),
      this.model.countDocuments(filter).exec(),
      this.model.aggregate<{ _id: null; amountPaise: number }>([
        { $match: filter },
        { $group: { _id: null, amountPaise: { $sum: '$amountPaise' } } },
      ]),
    ]);
    return {
      items: await this.present(docs),
      meta: {
        page,
        limit: pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        totals: { amountPaise: sums[0]?.amountPaise ?? 0, count: total },
      },
    };
  }

  private async buildFilter(q: ListPayoutsQuery): Promise<FilterQuery<PayoutDocument>> {
    const filter: FilterQuery<PayoutDocument> = { deletedAt: { $exists: false } };
    if (q.payeeType) filter.payeeType = q.payeeType;
    if (q.userId) filter.userId = new Types.ObjectId(q.userId);
    if (q.freelancerId) filter.freelancerId = new Types.ObjectId(q.freelancerId);
    if (q.method) filter.method = q.method;
    if (q.category) filter.category = q.category;
    if (q.projectId) filter.projectId = new Types.ObjectId(q.projectId);
    else if (q.clientId) {
      const ids = await this.projects.find({ clientId: new Types.ObjectId(q.clientId) }).distinct('_id').exec();
      filter.projectId = { $in: ids };
    }
    if (q.from || q.to) {
      filter.paidAt = {};
      if (q.from) filter.paidAt.$gte = dayStart(q.from);
      if (q.to) filter.paidAt.$lte = dayEnd(q.to);
    }
    if (q.q?.trim()) {
      const re = new RegExp(escapeRe(q.q.trim()), 'i');
      const [userIds, freelancerIds, projectIds] = await Promise.all([
        this.users.find({ name: re }).distinct('_id').exec(),
        this.freelancers.find({ name: re }).distinct('_id').exec(),
        this.projects.find({ $or: [{ name: re }, { code: re }] }).distinct('_id').exec(),
      ]);
      filter.$or = [
        { note: re },
        { reference: re },
        { userId: { $in: userIds } },
        { freelancerId: { $in: freelancerIds } },
        { projectId: { $in: projectIds } },
      ];
    }
    return filter;
  }

  // ── Balances (agreed vs paid) ────────────────────────────────────────────────────

  /** Everyone on a project — team and freelancers — with agreed / paid / pending. */
  async projectBalances(projectId: string): Promise<BalanceRow[]> {
    const project = await this.projects.findOne({ _id: projectId, deletedAt: { $exists: false } }).exec();
    if (!project) throw new NotFoundException({ code: ErrorCodes.PROJECT_NOT_FOUND, message: 'Project not found' });
    const paid = await this.sumBy({ projectId: project._id }, ['payeeType', 'userId', 'freelancerId']);

    const rows: BalanceRow[] = [];
    const seen = new Set<string>();
    for (const m of project.members) {
      const key = `${PayeeType.MEMBER}:${m.userId}`;
      seen.add(key);
      rows.push(this.row(PayeeType.MEMBER, m.userId.toString(), project, m.amountPaise ?? 0, paid.get(key)));
    }
    for (const f of project.freelancers ?? []) {
      const key = `${PayeeType.FREELANCER}:${f.freelancerId}`;
      seen.add(key);
      rows.push(this.row(PayeeType.FREELANCER, f.freelancerId.toString(), project, f.agreedPaise ?? 0, paid.get(key)));
    }
    // People paid on this project who have since been removed from it.
    for (const [key, p] of paid) {
      if (seen.has(key)) continue;
      const [type, id] = key.split(':') as [PayeeType, string];
      rows.push(this.row(type, id, project, 0, p));
    }
    return this.withNames(rows);
  }

  /** One person's deals across projects (team member or freelancer), plus general payments. */
  async payeeBalances(payeeType: PayeeType, payeeId: string): Promise<BalanceRow[]> {
    await this.ensureLegacyImported();
    const oid = new Types.ObjectId(payeeId);
    const projectFilter =
      payeeType === PayeeType.MEMBER ? { 'members.userId': oid } : { 'freelancers.freelancerId': oid };
    const payeeFilter = payeeType === PayeeType.MEMBER ? { userId: oid } : { freelancerId: oid };
    const [projects, paid] = await Promise.all([
      this.projects.find({ ...projectFilter, deletedAt: { $exists: false } }).exec(),
      this.sumBy(payeeFilter, ['projectId']),
    ]);

    const rows: BalanceRow[] = [];
    const seen = new Set<string>();
    for (const p of projects) {
      const agreed =
        payeeType === PayeeType.MEMBER
          ? (p.members.find((m) => m.userId.equals(oid))?.amountPaise ?? 0)
          : (p.freelancers.find((f) => f.freelancerId.equals(oid))?.agreedPaise ?? 0);
      seen.add(p.id);
      rows.push(this.row(payeeType, payeeId, p, agreed, paid.get(p.id)));
    }
    const missing = [...paid.keys()].filter((k) => k !== 'null' && !seen.has(k));
    if (missing.length) {
      const extra = await this.projects.find({ _id: { $in: missing.map((id) => new Types.ObjectId(id)) } }).exec();
      for (const p of extra) rows.push(this.row(payeeType, payeeId, p, 0, paid.get(p.id)));
    }
    const general = paid.get('null');
    if (general) rows.push(this.row(payeeType, payeeId, null, 0, general));
    return this.withNames(rows);
  }

  /** A team member's own view: their deals, totals and recent payments. */
  async earnings(userId: string) {
    const rows = await this.payeeBalances(PayeeType.MEMBER, userId);
    const now = new Date();
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    const monthStart = `${ymd(now).slice(0, 7)}-01`;
    const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyStart = `${fyYear}-04-01`;
    const oid = new Types.ObjectId(userId);
    const [docs, month, fy] = await Promise.all([
      this.model.find({ userId: oid, deletedAt: { $exists: false } }).sort({ paidAt: -1 }).limit(200).exec(),
      this.total({ userId: oid, paidAt: { $gte: dayStart(monthStart) } }),
      this.total({ userId: oid, paidAt: { $gte: dayStart(fyStart) } }),
    ]);
    const payouts = (await this.present(docs)).map(({ payeeName: _n, userId: _u, freelancerId: _f, ...rest }) => rest);
    return {
      totals: {
        thisMonthPaise: month,
        thisFyPaise: fy,
        allTimePaise: rows.reduce((s, r) => s + r.paidPaise, 0),
        pendingPaise: rows.reduce((s, r) => s + r.pendingPaise, 0),
      },
      projects: rows.map(({ payeeName: _n, payeeId: _i, payeeType: _t, ...rest }) => rest),
      payouts,
    };
  }

  /** Paid totals (and entries) for one member across the given projects — used by the project presenter. */
  async memberPaidByProject(userId: string, projectIds: Types.ObjectId[]) {
    const docs = await this.model
      .find({ userId: new Types.ObjectId(userId), projectId: { $in: projectIds }, deletedAt: { $exists: false } })
      .sort({ paidAt: -1 })
      .exec();
    const map = new Map<string, { paidPaise: number; payments: { _id: string; paidAt: Date; amountPaise: number; note: string; method: string; reference: string }[] }>();
    for (const d of docs) {
      const key = d.projectId!.toString();
      const entry = map.get(key) ?? { paidPaise: 0, payments: [] };
      entry.paidPaise += d.amountPaise;
      entry.payments.push({ _id: d.id, paidAt: d.paidAt, amountPaise: d.amountPaise, note: d.note, method: d.method, reference: d.reference });
      map.set(key, entry);
    }
    return map;
  }

  /** Money out for a project (team + freelancers) — used for project profit. */
  /** What each person has been paid on one project, keyed by user / freelancer id. */
  async paidOnProject(projectId: Types.ObjectId): Promise<{ members: Map<string, number>; freelancers: Map<string, number> }> {
    const rows = await this.model.aggregate<{ _id: { t: PayeeType; u?: Types.ObjectId; f?: Types.ObjectId }; amountPaise: number }>([
      { $match: { projectId, deletedAt: { $exists: false } } },
      { $group: { _id: { t: '$payeeType', u: '$userId', f: '$freelancerId' }, amountPaise: { $sum: '$amountPaise' } } },
    ]);
    const members = new Map<string, number>();
    const freelancers = new Map<string, number>();
    for (const r of rows) {
      if (r._id.t === PayeeType.MEMBER && r._id.u) members.set(String(r._id.u), r.amountPaise);
      if (r._id.t === PayeeType.FREELANCER && r._id.f) freelancers.set(String(r._id.f), r.amountPaise);
    }
    return { members, freelancers };
  }

  async projectCost(projectId: Types.ObjectId): Promise<{ teamPaise: number; freelancerPaise: number }> {
    await this.ensureLegacyImported();
    const sums = await this.model.aggregate<{ _id: PayeeType; amountPaise: number }>([
      { $match: { projectId, deletedAt: { $exists: false } } },
      { $group: { _id: '$payeeType', amountPaise: { $sum: '$amountPaise' } } },
    ]);
    return {
      teamPaise: sums.find((s) => s._id === PayeeType.MEMBER)?.amountPaise ?? 0,
      freelancerPaise: sums.find((s) => s._id === PayeeType.FREELANCER)?.amountPaise ?? 0,
    };
  }

  /** Everyone we still owe, summed per person across projects (team + freelancers). */
  // ── Older payment records ───────────────────────────────────────────────────────

  /** Moves any older payment records into the ledger as soon as the API starts. */
  onApplicationBootstrap(): void {
    void this.ensureLegacyImported(true);
  }

  /**
   * Money views only read the ledger, so older payment records still stored on projects would make
   * everyone look unpaid. This imports them (idempotent) whenever any are found — on start-up, and
   * again from money views, at most every 30s, so data written by a seed or an old app version is
   * picked up without anyone having to press a button. Never throws: a failed import is logged and
   * retried next time.
   */
  async ensureLegacyImported(force = false): Promise<void> {
    if (this.importRun) return this.importRun;
    if (!force && Date.now() - this.importCheckedAt < 30_000) return;
    this.importCheckedAt = Date.now();
    this.importRun = (async () => {
      try {
        const status = await this.importStatus();
        if (!status.pending) return;
        const owner = await this.users.findOne({ role: Role.OWNER, deletedAt: { $exists: false } }).select('_id').exec();
        if (!owner) return;
        const res = await this.importLegacy({ sub: String(owner._id) });
        this.log.log(`Imported older payment records into the ledger: ${JSON.stringify(res)}`);
      } catch (err) {
        this.log.error(`Couldn't import older payment records: ${(err as Error).message}`);
      } finally {
        this.importRun = null;
      }
    })();
    return this.importRun;
  }

  async owed() {
    await this.ensureLegacyImported();
    const projects = await this.projects
      .find({ deletedAt: { $exists: false } })
      .select('name members.userId members.amountPaise freelancers.freelancerId freelancers.agreedPaise')
      .exec();
    const paid = await this.sumBy({ projectId: { $in: projects.map((p) => p._id) } }, ['payeeType', 'userId', 'freelancerId', 'projectId']);
    const owed = new Map<string, { payeeType: PayeeType; payeeId: string; pendingPaise: number; projects: number }>();
    const add = (type: PayeeType, payeeId: string, projectId: string, agreed: number) => {
      if (!agreed) return;
      const key = `${type}:${payeeId}:${projectId}`;
      const pending = agreed - (paid.get(key)?.amountPaise ?? 0);
      if (pending <= 0) return;
      const k = `${type}:${payeeId}`;
      const row = owed.get(k) ?? { payeeType: type, payeeId, pendingPaise: 0, projects: 0 };
      row.pendingPaise += pending;
      row.projects += 1;
      owed.set(k, row);
    };
    for (const p of projects) {
      for (const m of p.members) add(PayeeType.MEMBER, m.userId.toString(), p.id, m.amountPaise ?? 0);
      for (const f of p.freelancers ?? []) add(PayeeType.FREELANCER, f.freelancerId.toString(), p.id, f.agreedPaise ?? 0);
    }
    const rows = [...owed.values()];
    const named = await this.withNames(
      rows.map((r) => ({ ...this.row(r.payeeType, r.payeeId, null, 0), pendingPaise: r.pendingPaise, payoutCount: r.projects })),
    );
    const sorted = named.sort((a, b) => b.pendingPaise - a.pendingPaise);
    return {
      team: sorted.filter((r) => r.payeeType === PayeeType.MEMBER).map((r) => ({ payeeId: r.payeeId, name: r.payeeName, pendingPaise: r.pendingPaise, projects: r.payoutCount })),
      freelancers: sorted.filter((r) => r.payeeType === PayeeType.FREELANCER).map((r) => ({ payeeId: r.payeeId, name: r.payeeName, pendingPaise: r.pendingPaise, projects: r.payoutCount })),
    };
  }

  // ── One-time import of the old payment records ──────────────────────────────────

  async importStatus() {
    const [memberAgg, legacyFreelancers] = await Promise.all([
      this.projects.aggregate<{ count: number; amountPaise: number }>([
        { $match: { deletedAt: { $exists: false } } },
        { $unwind: '$members' },
        { $unwind: '$members.payments' },
        { $group: { _id: null, count: { $sum: 1 }, amountPaise: { $sum: '$members.payments.amountPaise' } } },
      ]),
      this.legacyFreelancer.find({ deletedAt: { $exists: false }, migratedAt: { $exists: false } }).exec(),
    ]);
    return {
      memberPayments: memberAgg[0]?.count ?? 0,
      memberPaymentsPaise: memberAgg[0]?.amountPaise ?? 0,
      freelancerRecords: legacyFreelancers.length,
      freelancerPayments: legacyFreelancers.reduce((s, r) => s + (r.payments?.length ?? 0), 0),
      pending: (memberAgg[0]?.count ?? 0) + legacyFreelancers.length > 0,
    };
  }

  /**
   * Moves embedded project-member payments and old freelancer records into the ledger.
   * Idempotent: every imported entry carries a legacyId, so re-running never duplicates.
   */
  async importLegacy(actor: Actor) {
    let memberPayments = 0;
    let freelancerPayments = 0;
    let freelancersCreated = 0;
    const unmatched: { freelancer: string; projectRef: string }[] = [];

    // 1. Team payments embedded on projects.
    const projects = await this.projects.find({ 'members.payments.0': { $exists: true } }).exec();
    for (const p of projects) {
      for (const m of p.members) {
        for (const pay of (m.payments ?? []) as (typeof m.payments[number] & { _id: Types.ObjectId })[]) {
          const res = await this.model.updateOne(
            { legacyId: `pm:${pay._id}` },
            {
              $setOnInsert: {
                payeeType: PayeeType.MEMBER,
                userId: m.userId,
                projectId: p._id,
                amountPaise: pay.amountPaise,
                currency: p.currency ?? 'INR',
                paidAt: pay.paidAt,
                method: PayoutMethod.OTHER,
                category: PayoutCategory.PROJECT_FEE,
                note: [pay.note, pay.forPeriod ? `for ${pay.forPeriod}` : ''].filter(Boolean).join(' · '),
                reference: '',
                createdBy: new Types.ObjectId(actor.sub),
                legacyId: `pm:${pay._id}`,
              },
            },
            { upsert: true },
          );
          if (res.upsertedCount) memberPayments += 1;
        }
        m.payments = [];
      }
      p.markModified('members');
      await p.save();
    }

    // 2. Old free-text freelancer records → directory + project deal + payouts.
    const legacy = await this.legacyFreelancer.find({ deletedAt: { $exists: false }, migratedAt: { $exists: false } }).exec();
    for (const rec of legacy) {
      const email = rec.email?.trim().toLowerCase() || undefined;
      let freelancer =
        (email ? await this.freelancers.findOne({ email, deletedAt: { $exists: false } }).exec() : null) ??
        (await this.freelancers
          .findOne({ name: new RegExp(`^${escapeRe(rec.freelancerName.trim())}$`, 'i'), deletedAt: { $exists: false } })
          .exec());
      if (!freelancer) {
        freelancer = await this.freelancers.create({ name: rec.freelancerName.trim(), email, notes: rec.notes ?? '' });
        freelancersCreated += 1;
      }

      const ref = rec.projectRef?.trim() ?? '';
      const project = rec.projectId
        ? await this.projects.findById(rec.projectId).exec()
        : ref
          ? await this.projects
              .findOne({ $or: [{ name: new RegExp(`^${escapeRe(ref)}$`, 'i') }, { code: new RegExp(`^${escapeRe(ref)}$`, 'i') }], deletedAt: { $exists: false } })
              .exec()
          : null;

      if (project) {
        const existing = project.freelancers.find((f) => f.freelancerId.equals(freelancer!._id));
        if (existing) existing.agreedPaise += rec.agreedTotalPaise ?? 0;
        else project.freelancers.push({ freelancerId: freelancer._id, agreedPaise: rec.agreedTotalPaise ?? 0, scope: '', addedAt: new Date() } as never);
        project.markModified('freelancers');
        await project.save();
      } else {
        unmatched.push({ freelancer: freelancer.name, projectRef: ref || '(none)' });
        freelancer.legacyEngagements.push({ legacyId: `fp:${rec._id}`, projectRef: ref || '(none)', agreedPaise: rec.agreedTotalPaise ?? 0 } as never);
        await freelancer.save();
      }

      for (let i = 0; i < (rec.payments ?? []).length; i++) {
        const entry = rec.payments[i]!;
        const res = await this.model.updateOne(
          { legacyId: `fp:${rec._id}:${i}` },
          {
            $setOnInsert: {
              payeeType: PayeeType.FREELANCER,
              freelancerId: freelancer._id,
              projectId: project?._id,
              amountPaise: entry.amountPaise,
              currency: rec.currency ?? 'INR',
              paidAt: entry.date,
              method: PayoutMethod.OTHER,
              category: PayoutCategory.PROJECT_FEE,
              note: [entry.note, project ? '' : `Legacy project: ${ref || '(none)'}`].filter(Boolean).join(' · '),
              reference: '',
              createdBy: new Types.ObjectId(actor.sub),
              legacyId: `fp:${rec._id}:${i}`,
            },
          },
          { upsert: true },
        );
        if (res.upsertedCount) freelancerPayments += 1;
      }
      await this.legacyFreelancer.updateOne({ _id: rec._id }, { $set: { migratedAt: new Date() } }).exec();
    }

    const result = { memberPayments, freelancerPayments, freelancersCreated, unmatched };
    emitAudit(this.events, {
      actorId: actor.sub,
      action: AuditAction.PAYOUTS_IMPORTED,
      entity: 'payout',
      summary: `Imported ${memberPayments} team and ${freelancerPayments} freelancer payments`,
      after: result,
    });
    return result;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────────

  private async byIdOrThrow(id: string): Promise<PayoutDocument> {
    const doc = await this.model.findOne({ _id: id, deletedAt: { $exists: false } }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Payment not found' });
    return doc;
  }

  private async resolvePayee(type: PayeeType, userId?: string, freelancerId?: string): Promise<{ id: string; name: string }> {
    if (type === PayeeType.MEMBER) {
      const u = await this.users.findOne({ _id: userId, deletedAt: { $exists: false } }).select('name').exec();
      if (!u) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Team member not found' });
      return { id: u.id, name: u.name };
    }
    const f = await this.freelancers.findOne({ _id: freelancerId, deletedAt: { $exists: false } }).select('name').exec();
    if (!f) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Freelancer not found' });
    return { id: f.id, name: f.name };
  }

  private isOnProject(project: ProjectDocument, type: PayeeType, payeeId: string): boolean {
    return type === PayeeType.MEMBER
      ? project.members.some((m) => m.userId.toString() === payeeId)
      : (project.freelancers ?? []).some((f) => f.freelancerId.toString() === payeeId);
  }

  private async balanceFor(project: ProjectDocument, type: PayeeType, payeeId: string) {
    const agreedPaise =
      type === PayeeType.MEMBER
        ? (project.members.find((m) => m.userId.toString() === payeeId)?.amountPaise ?? 0)
        : (project.freelancers.find((f) => f.freelancerId.toString() === payeeId)?.agreedPaise ?? 0);
    const paidPaise = await this.total({
      projectId: project._id,
      ...(type === PayeeType.MEMBER ? { userId: new Types.ObjectId(payeeId) } : { freelancerId: new Types.ObjectId(payeeId) }),
    });
    return { agreedPaise, paidPaise };
  }

  private async total(match: FilterQuery<PayoutDocument>): Promise<number> {
    const [r] = await this.model.aggregate<{ amountPaise: number }>([
      { $match: { ...match, deletedAt: { $exists: false } } },
      { $group: { _id: null, amountPaise: { $sum: '$amountPaise' } } },
    ]);
    return r?.amountPaise ?? 0;
  }

  /** Sum payouts grouped by the given keys; map key is the joined key values (payeeType:id or projectId). */
  private async sumBy(match: FilterQuery<PayoutDocument>, keys: ('payeeType' | 'userId' | 'freelancerId' | 'projectId')[]) {
    const id = Object.fromEntries(keys.map((k) => [k, `$${k}`]));
    const rows = await this.model.aggregate<{ _id: Record<string, unknown>; amountPaise: number; count: number; last: Date }>([
      { $match: { ...match, deletedAt: { $exists: false } } },
      { $group: { _id: id, amountPaise: { $sum: '$amountPaise' }, count: { $sum: 1 }, last: { $max: '$paidAt' } } },
    ]);
    const map = new Map<string, { amountPaise: number; count: number; last: Date }>();
    for (const r of rows) {
      const key = keys.includes('payeeType')
        ? `${r._id.payeeType}:${String(r._id.userId ?? r._id.freelancerId)}${keys.includes('projectId') ? `:${String(r._id.projectId ?? null)}` : ''}`
        : String(r._id.projectId ?? null);
      map.set(key, { amountPaise: r.amountPaise, count: r.count, last: r.last });
    }
    return map;
  }

  private row(
    payeeType: PayeeType,
    payeeId: string,
    project: ProjectDocument | null,
    agreedPaise: number,
    paid?: { amountPaise: number; count: number; last: Date },
  ): BalanceRow {
    const paidPaise = paid?.amountPaise ?? 0;
    return {
      payeeType,
      payeeId,
      payeeName: '',
      projectId: project?.id ?? null,
      projectName: project?.name ?? 'Not tied to a project',
      projectCode: project?.code,
      projectStatus: project?.status,
      agreedPaise,
      paidPaise,
      pendingPaise: Math.max(0, agreedPaise - paidPaise),
      lastPaidAt: paid?.last,
      payoutCount: paid?.count ?? 0,
    };
  }

  private async withNames(rows: BalanceRow[]): Promise<BalanceRow[]> {
    const userIds = rows.filter((r) => r.payeeType === PayeeType.MEMBER).map((r) => r.payeeId);
    const flIds = rows.filter((r) => r.payeeType === PayeeType.FREELANCER).map((r) => r.payeeId);
    const [users, fls] = await Promise.all([
      userIds.length ? this.users.find({ _id: { $in: userIds } }).select('name').exec() : [],
      flIds.length ? this.freelancers.find({ _id: { $in: flIds } }).select('name').exec() : [],
    ]);
    const names = new Map<string, string>([...users, ...fls].map((d) => [d.id as string, (d as { name: string }).name]));
    return rows.map((r) => ({ ...r, payeeName: names.get(r.payeeId) ?? 'Removed person' }));
  }

  async present(docs: PayoutDocument[]): Promise<PayoutView[]> {
    const userIds = [...new Set(docs.filter((d) => d.userId).map((d) => d.userId!.toString()))];
    const flIds = [...new Set(docs.filter((d) => d.freelancerId).map((d) => d.freelancerId!.toString()))];
    const projectIds = [...new Set(docs.filter((d) => d.projectId).map((d) => d.projectId!.toString()))];
    const [users, fls, projects] = await Promise.all([
      userIds.length ? this.users.find({ _id: { $in: userIds } }).select('name').exec() : [],
      flIds.length ? this.freelancers.find({ _id: { $in: flIds } }).select('name').exec() : [],
      projectIds.length ? this.projects.find({ _id: { $in: projectIds } }).select('name code').exec() : [],
    ]);
    const names = new Map<string, string>([...users, ...fls].map((d) => [d.id as string, (d as { name: string }).name]));
    const projMap = new Map(projects.map((p) => [p.id as string, p]));
    return docs.map((d) => {
      const payeeId = (d.userId ?? d.freelancerId)?.toString() ?? '';
      const proj = d.projectId ? projMap.get(d.projectId.toString()) : undefined;
      return {
        _id: d.id,
        payeeType: d.payeeType,
        userId: d.userId?.toString(),
        freelancerId: d.freelancerId?.toString(),
        payeeName: names.get(payeeId) ?? 'Removed person',
        projectId: d.projectId?.toString(),
        projectName: proj?.name,
        projectCode: proj?.code,
        amountPaise: d.amountPaise,
        currency: d.currency,
        paidAt: d.paidAt,
        method: d.method,
        reference: d.reference,
        category: d.category,
        note: d.note,
        createdAt: (d as unknown as { createdAt?: Date }).createdAt,
      };
    });
  }
}
