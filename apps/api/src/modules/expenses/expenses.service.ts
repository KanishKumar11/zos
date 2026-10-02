// ExpensesService — OWNER-only business expense tracking.
//
// amountPaise is the gross cost; team-member contributions (recovered through pay) reduce it to the
// net cost the agency actually bears. The dashboard uses net, so every total here returns both.
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { type FilterQuery, Model, Types } from 'mongoose';

import { AuditAction } from '@agency/shared';

import { emitAudit, snapshot } from '@/common/utils/audit.util';

import { Project, type ProjectDocument } from '../projects/schemas/project.schema';
import { User, type UserDocument } from '../users/schemas/user.schema';
import type {
  CreateExpenseDto,
  ExpenseContributionDto,
  ExpenseSummaryQueryDto,
  ListExpensesQueryDto,
  UpdateExpenseDto,
} from './dto/expense.dto';
import { dateToYmd, dayEnd, dayStart, dayToDate, escapeRe, inr, nextPeriodYmd } from './money-dates.util';
import {
  Expense,
  ExpenseRecurring,
  LEGACY_EXPENSE_CATEGORIES,
  type ExpenseCategory,
  type ExpenseDocument,
} from './schemas/expense.schema';

/** Per-document net expense (gross less contributions) — same expression the dashboard uses. */
const NET_EXPR = { $subtract: [{ $ifNull: ['$amountPaise', 0] }, { $sum: '$contributions.amountPaise' }] };

export interface ExpenseView {
  _id: string;
  title: string;
  description?: string;
  amountPaise: number;
  netPaise: number;
  category: ExpenseCategory;
  date: Date;
  vendor?: string;
  receiptRef?: string;
  currency: string;
  addedBy?: string;
  addedByName?: string;
  contributions: { userId: string; userName?: string; amountPaise: number; note: string }[];
  projectId?: string;
  projectName?: string;
  projectCode?: string;
  projectDeleted?: boolean;
  billable: boolean;
  recurring: ExpenseRecurring;
  repeatOfId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Totals {
  grossPaise: number;
  netPaise: number;
  count: number;
}

const LEGACY_MSG = 'Team and freelancer payments are logged under Payments out, not as expenses.';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectModel(Expense.name) private readonly model: Model<ExpenseDocument>,
    @InjectModel(Project.name) private readonly projects: Model<ProjectDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly events: EventEmitter2,
  ) {}

  // ── Reads ────────────────────────────────────────────────────────────────────────

  async list(q: ListExpensesQueryDto) {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(500, Math.max(1, q.pageSize ?? q.limit ?? 20));
    const filter = await this.buildFilter(q);
    const sort: Record<string, 1 | -1> =
      q.sort === 'date:asc'
        ? { date: 1, _id: 1 }
        : q.sort === 'amount:desc'
          ? { amountPaise: -1, date: -1 }
          : q.sort === 'amount:asc'
            ? { amountPaise: 1, date: -1 }
            : { date: -1, _id: -1 };

    const [docs, totals] = await Promise.all([
      this.model.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).exec(),
      this.totals(filter),
    ]);
    return {
      items: await this.present(docs),
      meta: {
        page,
        limit,
        total: totals.count,
        totalPages: Math.max(1, Math.ceil(totals.count / limit)),
        totals,
      },
    };
  }

  /** Totals by category for the same filters the list uses (gross and net). */
  async summary(q: ExpenseSummaryQueryDto) {
    const filter = await this.buildFilter(q);
    const agg = await this.model
      .aggregate<{ _id: string; totalPaise: number; netPaise: number; count: number }>([
        { $match: filter },
        {
          $group: {
            _id: '$category',
            totalPaise: { $sum: { $ifNull: ['$amountPaise', 0] } },
            netPaise: { $sum: NET_EXPR },
            count: { $sum: 1 },
          },
        },
        { $sort: { totalPaise: -1 } },
      ])
      .exec();
    const grossPaise = agg.reduce((s, r) => s + r.totalPaise, 0);
    const netPaise = agg.reduce((s, r) => s + r.netPaise, 0);
    const count = agg.reduce((s, r) => s + r.count, 0);
    return { byCategory: agg, grandTotalPaise: grossPaise, grossPaise, netPaise, count };
  }

  async byId(id: string): Promise<ExpenseView> {
    const [view] = await this.present([await this.byIdOrThrow(id)]);
    return view!;
  }

  // ── Writes ───────────────────────────────────────────────────────────────────────

  async create(input: CreateExpenseDto, actorId: string): Promise<ExpenseView> {
    if (LEGACY_EXPENSE_CATEGORIES.includes(input.category)) throw new BadRequestException({ code: 'LEGACY_CATEGORY', message: LEGACY_MSG });
    const contributions = this.cleanContributions(input.contributions ?? [], input.amountPaise);
    const projectId = input.projectId ? await this.resolveProject(input.projectId) : undefined;

    const doc = await this.model.create({
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      amountPaise: input.amountPaise,
      category: input.category,
      date: dayToDate(input.date),
      vendor: input.vendor?.trim() || undefined,
      receiptRef: input.receiptRef || undefined,
      currency: input.currency ?? 'INR',
      addedBy: new Types.ObjectId(actorId),
      contributions,
      projectId,
      billable: projectId ? !!input.billable : false,
      recurring: input.recurring ?? ExpenseRecurring.NONE,
    });

    emitAudit(this.events, {
      actorId,
      action: AuditAction.EXPENSE_CREATED,
      entity: 'expense',
      entityId: doc.id,
      summary: `${inr(doc.amountPaise)} · ${doc.title}`,
    });
    return this.byId(doc.id);
  }

  async update(id: string, input: UpdateExpenseDto, actorId: string): Promise<ExpenseView> {
    const doc = await this.byIdOrThrow(id);
    const before = snapshot(doc);

    // Explicit nulls on required fields are rejected (the DTO already does; this guards other callers).
    for (const k of ['title', 'amountPaise', 'category', 'date', 'billable', 'recurring', 'contributions'] as const) {
      if (k in input && (input as Record<string, unknown>)[k] === null) {
        throw new BadRequestException({ code: 'VALIDATION_ERROR', message: `${k === 'amountPaise' ? 'Amount' : k} can't be empty` });
      }
    }
    if (input.category !== undefined && input.category !== doc.category && LEGACY_EXPENSE_CATEGORIES.includes(input.category)) {
      throw new BadRequestException({ code: 'LEGACY_CATEGORY', message: LEGACY_MSG });
    }

    const $set: Record<string, unknown> = {};
    const $unset: Record<string, ''> = {};

    if (input.title !== undefined) $set.title = input.title.trim();
    if (input.description !== undefined) $set.description = input.description.trim();
    if (input.amountPaise !== undefined) $set.amountPaise = input.amountPaise;
    if (input.category !== undefined) $set.category = input.category;
    if (input.date !== undefined) $set.date = dayToDate(input.date);
    if (input.vendor !== undefined) $set.vendor = input.vendor.trim();
    if (input.currency !== undefined) $set.currency = input.currency;
    if (input.recurring !== undefined) $set.recurring = input.recurring;
    if (input.receiptRef !== undefined) {
      if (input.receiptRef) $set.receiptRef = input.receiptRef;
      else $unset.receiptRef = '';
    }

    // Contributions are checked against the resulting amount, whichever of the two changed.
    const amount = input.amountPaise ?? doc.amountPaise;
    if (input.contributions !== undefined) {
      $set.contributions = this.cleanContributions(input.contributions, amount);
    } else if (input.amountPaise !== undefined) {
      const recovered = (doc.contributions ?? []).reduce((s, c) => s + (c.amountPaise ?? 0), 0);
      if (recovered > amount) {
        throw new BadRequestException({
          code: 'CONTRIBUTIONS_EXCEED_AMOUNT',
          message: `Team contributions (${inr(recovered)}) are more than the new amount (${inr(amount)}).`,
          details: { fieldErrors: { amountPaise: ['Less than the team contributions'] } },
        });
      }
    }

    let projectLinked = !!doc.projectId;
    if (input.projectId !== undefined) {
      if (input.projectId) {
        $set.projectId = await this.resolveProject(input.projectId, doc.projectId);
        projectLinked = true;
      } else {
        $unset.projectId = '';
        projectLinked = false;
      }
    }
    if (input.billable !== undefined) $set.billable = projectLinked ? input.billable : false;
    else if (!projectLinked && doc.billable) $set.billable = false;

    const update: Record<string, unknown> = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;
    const updated = Object.keys(update).length
      ? await this.model
          .findOneAndUpdate({ _id: doc._id, deletedAt: { $exists: false } }, update, { new: true, runValidators: true })
          .exec()
      : doc;
    if (!updated) throw new NotFoundException('Expense not found');

    emitAudit(this.events, {
      actorId,
      action: AuditAction.EXPENSE_UPDATED,
      entity: 'expense',
      entityId: updated.id,
      summary: `${inr(updated.amountPaise)} · ${updated.title}`,
      before,
      after: snapshot(updated),
    });
    return this.byId(updated.id);
  }

  async remove(id: string, actorId: string): Promise<void> {
    const doc = await this.byIdOrThrow(id);
    // updateOne, not save(): old rows can hold values that no longer pass validation.
    await this.model.updateOne({ _id: doc._id }, { $set: { deletedAt: new Date() } }).exec();
    emitAudit(this.events, {
      actorId,
      action: AuditAction.EXPENSE_DELETED,
      entity: 'expense',
      entityId: doc.id,
      summary: `${inr(doc.amountPaise ?? 0)} · ${doc.title}`,
      before: snapshot(doc),
    });
  }

  /** Copies a recurring expense into the next period (date moved forward one month / year). */
  async repeat(id: string, actorId: string): Promise<ExpenseView> {
    const src = await this.byIdOrThrow(id);
    if (src.recurring !== ExpenseRecurring.MONTHLY && src.recurring !== ExpenseRecurring.YEARLY) {
      throw new BadRequestException({ code: 'NOT_RECURRING', message: 'Set this expense to repeat monthly or yearly first.' });
    }
    if (!src.amountPaise || src.amountPaise <= 0) {
      throw new BadRequestException({ code: 'NO_AMOUNT', message: 'Add an amount to this expense before repeating it.' });
    }
    const nextYmd = nextPeriodYmd(dateToYmd(src.date), src.recurring);
    const existing = await this.model.findOne({ repeatOfId: src._id, deletedAt: { $exists: false } }).exec();
    if (existing) {
      throw new ConflictException({
        code: 'ALREADY_REPEATED',
        message: `This expense was already repeated (copy dated ${dateToYmd(existing.date)}). Repeat the newer one instead.`,
      });
    }

    const doc = await this.model.create({
      title: src.title,
      description: src.description,
      amountPaise: src.amountPaise,
      category: src.category,
      date: dayToDate(nextYmd),
      vendor: src.vendor,
      currency: src.currency ?? 'INR',
      addedBy: new Types.ObjectId(actorId),
      contributions: (src.contributions ?? []).map((c) => ({ userId: c.userId, amountPaise: c.amountPaise, note: c.note ?? '' })),
      projectId: src.projectId,
      billable: !!src.projectId && !!src.billable,
      recurring: src.recurring,
      repeatOfId: src._id,
    });
    emitAudit(this.events, {
      actorId,
      action: AuditAction.EXPENSE_CREATED,
      entity: 'expense',
      entityId: doc.id,
      summary: `Repeated ${src.title} for ${nextYmd} (${inr(doc.amountPaise)})`,
    });
    return this.byId(doc.id);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────────

  private async byIdOrThrow(id: string): Promise<ExpenseDocument> {
    const doc = await this.model.findOne({ _id: id, deletedAt: { $exists: false } }).exec();
    if (!doc) throw new NotFoundException('Expense not found');
    return doc;
  }

  private async buildFilter(q: ExpenseSummaryQueryDto): Promise<FilterQuery<ExpenseDocument>> {
    const filter: FilterQuery<ExpenseDocument> = { deletedAt: { $exists: false } };
    if (q.category) filter.category = q.category;
    if (q.contributorId) filter['contributions.userId'] = new Types.ObjectId(q.contributorId);
    if (q.projectId) filter.projectId = new Types.ObjectId(q.projectId);
    if (q.billable !== undefined) filter.billable = q.billable ? true : { $ne: true };
    if (q.recurring) {
      filter.recurring = q.recurring === ExpenseRecurring.NONE ? { $in: [ExpenseRecurring.NONE, null] } : q.recurring;
    }
    if (q.from || q.to) {
      const range: Record<string, Date> = {};
      if (q.from) range.$gte = dayStart(q.from);
      if (q.to) range.$lte = dayEnd(q.to);
      filter.date = range;
    }
    if (q.q?.trim()) {
      const re = new RegExp(escapeRe(q.q.trim()), 'i');
      const projectIds = await this.projects.find({ $or: [{ name: re }, { code: re }] }).distinct('_id').exec();
      filter.$or = [{ title: re }, { vendor: re }, { description: re }, { projectId: { $in: projectIds } }];
    }
    return filter;
  }

  private async totals(filter: FilterQuery<ExpenseDocument>): Promise<Totals> {
    const [row] = await this.model
      .aggregate<{ grossPaise: number; netPaise: number; count: number }>([
        { $match: filter },
        {
          $group: {
            _id: null,
            grossPaise: { $sum: { $ifNull: ['$amountPaise', 0] } },
            netPaise: { $sum: NET_EXPR },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();
    return { grossPaise: row?.grossPaise ?? 0, netPaise: row?.netPaise ?? 0, count: row?.count ?? 0 };
  }

  /** Validates contributions: a member, a positive amount, no one twice, and never more than the cost. */
  private cleanContributions(list: ExpenseContributionDto[], amountPaise: number) {
    const seen = new Set<string>();
    const fieldErrors: Record<string, string[]> = {};
    list.forEach((c, i) => {
      if (seen.has(c.userId)) fieldErrors[`contributions.${i}.userId`] = ['Already added'];
      seen.add(c.userId);
    });
    if (Object.keys(fieldErrors).length) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'The same person is listed twice in team contributions.',
        details: { fieldErrors },
      });
    }
    const recovered = list.reduce((s, c) => s + c.amountPaise, 0);
    if (recovered > amountPaise) {
      throw new BadRequestException({
        code: 'CONTRIBUTIONS_EXCEED_AMOUNT',
        message: `Team contributions (${inr(recovered)}) can't be more than the expense (${inr(amountPaise)}).`,
        details: { fieldErrors: { contributions: ['More than the expense amount'] } },
      });
    }
    return list.map((c) => ({ userId: new Types.ObjectId(c.userId), amountPaise: c.amountPaise, note: c.note?.trim() ?? '' }));
  }

  /** A live project id, or — when the expense already points at it — a since-deleted one is kept. */
  private async resolveProject(id: string, current?: Types.ObjectId): Promise<Types.ObjectId> {
    if (current && current.equals(id)) return current;
    const project = await this.projects.findOne({ _id: id, deletedAt: { $exists: false } }).select('_id').exec();
    if (!project) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: 'That project no longer exists.',
        details: { fieldErrors: { projectId: ['Project not found'] } },
      });
    }
    return project._id;
  }

  private async present(docs: ExpenseDocument[]): Promise<ExpenseView[]> {
    const projectIds = new Set<string>();
    const userIds = new Set<string>();
    for (const d of docs) {
      if (d.projectId) projectIds.add(d.projectId.toString());
      if (d.addedBy) userIds.add(d.addedBy.toString());
      for (const c of d.contributions ?? []) if (c.userId) userIds.add(c.userId.toString());
    }
    const [projects, users] = await Promise.all([
      projectIds.size
        ? this.projects
            .find({ _id: { $in: [...projectIds].map((id) => new Types.ObjectId(id)) } })
            .select('name code deletedAt')
            .lean<{ _id: Types.ObjectId; name: string; code?: string; deletedAt?: Date }[]>()
            .exec()
        : [],
      userIds.size
        ? this.users
            .find({ _id: { $in: [...userIds].map((id) => new Types.ObjectId(id)) } })
            .select('name')
            .lean<{ _id: Types.ObjectId; name: string }[]>()
            .exec()
        : [],
    ]);
    const projectMap = new Map(projects.map((p) => [p._id.toString(), p]));
    const userMap = new Map(users.map((u) => [u._id.toString(), u.name]));

    return docs.map((d) => {
      const contributions = (d.contributions ?? []).map((c) => ({
        userId: c.userId?.toString() ?? '',
        userName: c.userId ? userMap.get(c.userId.toString()) : undefined,
        amountPaise: c.amountPaise ?? 0,
        note: c.note ?? '',
      }));
      const project = d.projectId ? projectMap.get(d.projectId.toString()) : undefined;
      const amount = d.amountPaise ?? 0;
      return {
        _id: d.id as string,
        title: d.title,
        description: d.description,
        amountPaise: amount,
        netPaise: amount - contributions.reduce((s, c) => s + c.amountPaise, 0),
        category: d.category,
        date: d.date,
        vendor: d.vendor,
        receiptRef: d.receiptRef,
        currency: d.currency ?? 'INR',
        addedBy: d.addedBy?.toString(),
        addedByName: d.addedBy ? userMap.get(d.addedBy.toString()) : undefined,
        contributions,
        projectId: d.projectId?.toString(),
        projectName: project?.name,
        projectCode: project?.code,
        projectDeleted: d.projectId ? !project || !!project.deletedAt : undefined,
        billable: !!d.billable,
        recurring: d.recurring ?? ExpenseRecurring.NONE,
        repeatOfId: d.repeatOfId?.toString(),
        createdAt: (d as unknown as { createdAt?: Date }).createdAt,
        updatedAt: (d as unknown as { updatedAt?: Date }).updatedAt,
      };
    });
  }
}
