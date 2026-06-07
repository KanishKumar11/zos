// FreelancerPaymentsService — tracks contract agreements + payment history.
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { paginate } from '@/common/utils/pagination.util';

import {
  FreelancerPayment,
  type FreelancerPaymentDocument,
} from './schemas/freelancer-payment.schema';
import type {
  AddFreelancerPaymentEntryDto,
  CreateFreelancerPaymentDto,
  UpdateFreelancerPaymentDto,
} from './dto/freelancer-payment.dto';

@Injectable()
export class FreelancerPaymentsService {
  constructor(
    @InjectModel(FreelancerPayment.name)
    private readonly model: Model<FreelancerPaymentDocument>,
  ) {}

  async list(opts: { page?: number; limit?: number; status?: string }) {
    const filter: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (opts.status) filter.status = opts.status;
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.model.countDocuments(filter),
    ]);
    return paginate(items, total, page, limit);
  }

  async byId(id: string): Promise<FreelancerPaymentDocument> {
    const doc = await this.model.findOne({ _id: id, deletedAt: { $exists: false } }).exec();
    if (!doc) throw new NotFoundException('Freelancer payment record not found');
    return doc;
  }

  async create(input: CreateFreelancerPaymentDto): Promise<FreelancerPaymentDocument> {
    const agreed = input.agreedTotalPaise;
    return this.model.create({
      ...input,
      agreedTotalPaise: agreed,
      paidPaise: 0,
      pendingPaise: agreed,
      currency: input.currency ?? 'INR',
      projectId: input.projectId ? new Types.ObjectId(input.projectId) : undefined,
    });
  }

  async update(id: string, input: UpdateFreelancerPaymentDto): Promise<FreelancerPaymentDocument> {
    const doc = await this.byId(id);
    Object.assign(doc, input);
    if (input.agreedTotalPaise !== undefined) {
      doc.pendingPaise = input.agreedTotalPaise - doc.paidPaise;
    }
    return doc.save();
  }

  async addPayment(id: string, entry: AddFreelancerPaymentEntryDto): Promise<FreelancerPaymentDocument> {
    const doc = await this.byId(id);
    doc.payments.push({ date: new Date(entry.date), amountPaise: entry.amountPaise, note: entry.note ?? '' });
    doc.paidPaise = doc.payments.reduce((s, p) => s + p.amountPaise, 0);
    doc.pendingPaise = Math.max(0, doc.agreedTotalPaise - doc.paidPaise);
    if (doc.pendingPaise === 0) doc.status = 'COMPLETED';
    return doc.save();
  }

  async remove(id: string): Promise<void> {
    const doc = await this.byId(id);
    doc.deletedAt = new Date();
    await doc.save();
  }
}
