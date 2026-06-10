// ContractsService — CRUD for retainer contracts.
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  InvoiceStatus,
  type CreateContractInput,
  type ListContractsQuery,
  type UpdateContractInput,
} from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';

import { Invoice, type InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { Contract, type ContractDocument } from './schemas/contract.schema';

@Injectable()
export class ContractsService {
  constructor(
    @InjectModel(Contract.name) private readonly model: Model<ContractDocument>,
    @InjectModel(Invoice.name) private readonly invoices: Model<InvoiceDocument>,
  ) {}

  list(q: ListContractsQuery = {}): Promise<ContractDocument[]> {
    const filter: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (q.clientId) filter.clientId = new Types.ObjectId(q.clientId);
    if (q.status) filter.status = q.status;
    return this.model.find(filter).sort({ createdAt: -1 }).exec();
  }

  async byId(id: string): Promise<ContractDocument> {
    const doc = await this.model
      .findOne({ _id: id, deletedAt: { $exists: false } })
      .exec();
    if (!doc)
      throw new NotFoundException({
        code: ErrorCodes.NOT_FOUND,
        message: 'Contract not found',
      });
    return doc;
  }

  create(input: CreateContractInput): Promise<ContractDocument> {
    const doc = new this.model({
      ...input,
      clientId: new Types.ObjectId(input.clientId),
      currency: input.currency ?? 'INR',
    });
    return doc.save();
  }

  async update(id: string, input: UpdateContractInput): Promise<ContractDocument> {
    const doc = await this.byId(id);
    Object.assign(doc, input);
    if (input.clientId) doc.clientId = new Types.ObjectId(input.clientId);
    return doc.save();
  }

  async remove(id: string): Promise<void> {
    const doc = await this.byId(id);
    doc.deletedAt = new Date();
    await doc.save();
  }

  /** Generate a draft invoice for this contract for a given month (YYYY-MM). */
  async generateInvoice(id: string, month: string): Promise<InvoiceDocument> {
    const contract = await this.byId(id);

    const parts = month.split('-').map(Number);
    const issueDate = new Date(parts[0]!, parts[1]! - 1, 1);
    const monthEnd = new Date(parts[0]!, parts[1]!, 1);

    // Prevent duplicate — one invoice per contract per month
    const existing = await this.invoices.findOne({
      contractId: contract._id,
      issueDate: { $gte: issueDate, $lt: monthEnd },
    }).exec();
    if (existing) {
      throw new ConflictException({
        code: ErrorCodes.CONFLICT,
        message: `Invoice already exists for ${month}`,
      });
    }

    // Auto-increment invoice number: ZLK-YYYY-NNNN (per year, exclude soft-deleted)
    const year = issueDate.getFullYear();
    const yearCount = await this.invoices.countDocuments({
      deletedAt: { $exists: false },
      issueDate: { $gte: new Date(year, 0, 1), $lt: new Date(year + 1, 0, 1) },
    }).exec();
    const num = `ZLK-${year}-${String(yearCount + 1).padStart(4, '0')}`;

    return this.invoices.create({
      number: num,
      clientId: contract.clientId,
      contractId: contract._id,
      lineItems: [{ description: `${contract.name} — ${month}`, qty: 1, unitPaise: contract.monthlyAmountPaise }],
      subTotalPaise: contract.monthlyAmountPaise,
      gstPercent: 0,
      gstPaise: 0,
      totalPaise: contract.monthlyAmountPaise,
      paidPaise: 0,
      currency: contract.currency,
      status: InvoiceStatus.DRAFT,
      issueDate,
      payments: [],
      notes: `Auto-generated for ${contract.name} — ${month}`,
    });
  }
}
