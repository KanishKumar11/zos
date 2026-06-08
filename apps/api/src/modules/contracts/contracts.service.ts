// ContractsService — CRUD for retainer contracts.
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  type CreateContractInput,
  type ListContractsQuery,
  type UpdateContractInput,
} from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';

import { Contract, type ContractDocument } from './schemas/contract.schema';

@Injectable()
export class ContractsService {
  constructor(
    @InjectModel(Contract.name) private readonly model: Model<ContractDocument>,
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
}
