// IncomeService — OWNER-only non-client revenue tracking.
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { type FilterQuery, Model, Types } from 'mongoose';

import { AuditAction } from '@agency/shared';

import { emitAudit, snapshot } from '@/common/utils/audit.util';

import { dayEnd, dayStart, dayToDate, escapeRe, inr } from '../expenses/money-dates.util';
import { Income, type IncomeDocument } from './schemas/income.schema';
import type { CreateIncomeDto, IncomeSummaryQueryDto, ListIncomeQueryDto, UpdateIncomeDto } from './dto/income.dto';

@Injectable()
export class IncomeService {
  constructor(
    @InjectModel(Income.name) private readonly model: Model<IncomeDocument>,
    private readonly events: EventEmitter2,
  ) {}

  async list(q: ListIncomeQueryDto) {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(500, Math.max(1, q.pageSize ?? q.limit ?? 20));
    const filter = this.buildFilter(q);
    const sort: Record<string, 1 | -1> =
      q.sort === 'date:asc'
        ? { date: 1, _id: 1 }
        : q.sort === 'amount:desc'
          ? { amountPaise: -1, date: -1 }
          : q.sort === 'amount:asc'
            ? { amountPaise: 1, date: -1 }
            : { date: -1, _id: -1 };
    const [items, sums] = await Promise.all([
      this.model.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).exec(),
      this.model
        .aggregate<{ amountPaise: number; count: number }>([
          { $match: filter },
          { $group: { _id: null, amountPaise: { $sum: { $ifNull: ['$amountPaise', 0] } }, count: { $sum: 1 } } },
        ])
        .exec(),
    ]);
    const total = sums[0]?.count ?? 0;
    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        totals: { amountPaise: sums[0]?.amountPaise ?? 0, count: total },
      },
    };
  }

  /** Totals by category for the same filters the list uses. */
  async summary(q: IncomeSummaryQueryDto) {
    const agg = await this.model
      .aggregate<{ _id: string; totalPaise: number; count: number }>([
        { $match: this.buildFilter(q) },
        { $group: { _id: '$category', totalPaise: { $sum: { $ifNull: ['$amountPaise', 0] } }, count: { $sum: 1 } } },
        { $sort: { totalPaise: -1 } },
      ])
      .exec();
    const grandTotal = agg.reduce((s, r) => s + r.totalPaise, 0);
    return { byCategory: agg, grandTotalPaise: grandTotal, count: agg.reduce((s, r) => s + r.count, 0) };
  }

  async byId(id: string): Promise<IncomeDocument> {
    const doc = await this.model.findOne({ _id: id, deletedAt: { $exists: false } }).exec();
    if (!doc) throw new NotFoundException('Income not found');
    return doc;
  }

  async create(input: CreateIncomeDto, actorId: string): Promise<IncomeDocument> {
    const doc = await this.model.create({
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      amountPaise: input.amountPaise,
      category: input.category,
      date: dayToDate(input.date),
      source: input.source?.trim() || undefined,
      receiptRef: input.receiptRef || undefined,
      currency: input.currency ?? 'INR',
      addedBy: new Types.ObjectId(actorId),
    });
    emitAudit(this.events, {
      actorId,
      action: AuditAction.INCOME_CREATED,
      entity: 'income',
      entityId: doc.id,
      summary: `${inr(doc.amountPaise)} · ${doc.title}`,
    });
    return doc;
  }

  async update(id: string, input: UpdateIncomeDto, actorId: string): Promise<IncomeDocument> {
    const doc = await this.byId(id);
    const before = snapshot(doc);
    for (const k of ['title', 'amountPaise', 'category', 'date'] as const) {
      if (k in input && (input as Record<string, unknown>)[k] === null) {
        throw new BadRequestException({ code: 'VALIDATION_ERROR', message: `${k === 'amountPaise' ? 'Amount' : k} can't be empty` });
      }
    }
    const $set: Record<string, unknown> = {};
    const $unset: Record<string, ''> = {};
    if (input.title !== undefined) $set.title = input.title.trim();
    if (input.description !== undefined) $set.description = input.description.trim();
    if (input.amountPaise !== undefined) $set.amountPaise = input.amountPaise;
    if (input.category !== undefined) $set.category = input.category;
    if (input.date !== undefined) $set.date = dayToDate(input.date);
    if (input.source !== undefined) $set.source = input.source.trim();
    if (input.currency !== undefined) $set.currency = input.currency;
    if (input.receiptRef !== undefined) {
      if (input.receiptRef) $set.receiptRef = input.receiptRef;
      else $unset.receiptRef = '';
    }
    const update: Record<string, unknown> = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;
    const updated = Object.keys(update).length
      ? await this.model
          .findOneAndUpdate({ _id: doc._id, deletedAt: { $exists: false } }, update, { new: true, runValidators: true })
          .exec()
      : doc;
    if (!updated) throw new NotFoundException('Income not found');
    emitAudit(this.events, {
      actorId,
      action: AuditAction.INCOME_UPDATED,
      entity: 'income',
      entityId: updated.id,
      summary: `${inr(updated.amountPaise)} · ${updated.title}`,
      before,
      after: snapshot(updated),
    });
    return updated;
  }

  async remove(id: string, actorId: string): Promise<void> {
    const doc = await this.byId(id);
    await this.model.updateOne({ _id: doc._id }, { $set: { deletedAt: new Date() } }).exec();
    emitAudit(this.events, {
      actorId,
      action: AuditAction.INCOME_DELETED,
      entity: 'income',
      entityId: doc.id,
      summary: `${inr(doc.amountPaise ?? 0)} · ${doc.title}`,
      before: snapshot(doc),
    });
  }

  private buildFilter(q: IncomeSummaryQueryDto): FilterQuery<IncomeDocument> {
    const filter: FilterQuery<IncomeDocument> = { deletedAt: { $exists: false } };
    if (q.category) filter.category = q.category;
    if (q.from || q.to) {
      const range: Record<string, Date> = {};
      if (q.from) range.$gte = dayStart(q.from);
      if (q.to) range.$lte = dayEnd(q.to);
      filter.date = range;
    }
    if (q.q?.trim()) {
      const re = new RegExp(escapeRe(q.q.trim()), 'i');
      filter.$or = [{ title: re }, { source: re }, { description: re }];
    }
    return filter;
  }
}
