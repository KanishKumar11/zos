// ExpensesService — OWNER-only business expense tracking.
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { paginate } from '@/common/utils/pagination.util';

import { Expense, type ExpenseDocument } from './schemas/expense.schema';
import type { CreateExpenseDto, UpdateExpenseDto } from './dto/expense.dto';

@Injectable()
export class ExpensesService {
  constructor(@InjectModel(Expense.name) private readonly model: Model<ExpenseDocument>) {}

  async list(opts: { page?: number; limit?: number; category?: string; from?: string; to?: string }) {
    const filter: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (opts.category) filter.category = opts.category;
    if (opts.from || opts.to) {
      const range: Record<string, Date> = {};
      if (opts.from) range.$gte = new Date(opts.from);
      if (opts.to) range.$lte = new Date(opts.to);
      filter.date = range;
    }
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ date: -1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.model.countDocuments(filter),
    ]);
    return paginate(items, total, page, limit);
  }

  async summary(from?: string, to?: string) {
    const filter: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (from || to) {
      const range: Record<string, Date> = {};
      if (from) range.$gte = new Date(from);
      if (to) range.$lte = new Date(to);
      filter.date = range;
    }
    const agg = await this.model
      .aggregate([
        { $match: filter },
        { $group: { _id: '$category', totalPaise: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
      ])
      .exec();
    const grandTotal = agg.reduce((s, r) => s + (r.totalPaise as number), 0);
    return { byCategory: agg, grandTotalPaise: grandTotal };
  }

  async byId(id: string): Promise<ExpenseDocument> {
    const doc = await this.model.findOne({ _id: id, deletedAt: { $exists: false } }).exec();
    if (!doc) throw new NotFoundException('Expense not found');
    return doc;
  }

  async create(input: CreateExpenseDto, addedBy: string): Promise<ExpenseDocument> {
    return this.model.create({
      ...input,
      date: new Date(input.date),
      currency: input.currency ?? 'INR',
      addedBy: new Types.ObjectId(addedBy),
    });
  }

  async update(id: string, input: UpdateExpenseDto): Promise<ExpenseDocument> {
    const update: Record<string, unknown> = { ...input };
    if (input.date) update.date = new Date(input.date);
    const doc = await this.model.findByIdAndUpdate(id, update, { new: true }).exec();
    if (!doc) throw new NotFoundException('Expense not found');
    return doc;
  }

  async remove(id: string): Promise<void> {
    const doc = await this.byId(id);
    doc.deletedAt = new Date();
    await doc.save();
  }
}
