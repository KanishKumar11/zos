// CrmService — opportunities pipeline.
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  CrmStage,
  type CreateOpportunityInput,
  type MoveOpportunityInput,
  type UpdateOpportunityInput,
} from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';

import {
  Opportunity,
  type OpportunityDocument,
} from './schemas/opportunity.schema';

@Injectable()
export class CrmService {
  constructor(
    @InjectModel(Opportunity.name) private readonly model: Model<OpportunityDocument>,
  ) {}

  list(stage?: CrmStage): Promise<OpportunityDocument[]> {
    const filter: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (stage) filter.stage = stage;
    return this.model.find(filter).sort({ stage: 1, position: 1 }).exec();
  }

  async byId(id: string): Promise<OpportunityDocument> {
    const doc = await this.model.findOne({ _id: id, deletedAt: { $exists: false } }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Opportunity not found' });
    return doc;
  }

  async create(input: CreateOpportunityInput): Promise<OpportunityDocument> {
    const stage = input.stage ?? CrmStage.LEAD;
    const last = await this.model.findOne({ stage }).sort({ position: -1 }).exec();
    return this.model.create({
      ...input,
      stage,
      currency: input.currency ?? 'INR',
      clientId: new Types.ObjectId(input.clientId),
      ownerId: input.ownerId ? new Types.ObjectId(input.ownerId) : undefined,
      position: last ? last.position + 1024 : 1024,
    });
  }

  async update(id: string, input: UpdateOpportunityInput): Promise<OpportunityDocument> {
    const patch: Record<string, unknown> = { ...input };
    if (input.clientId) patch.clientId = new Types.ObjectId(input.clientId);
    if (input.ownerId) patch.ownerId = new Types.ObjectId(input.ownerId);
    const doc = await this.model.findByIdAndUpdate(id, patch, { new: true }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Opportunity not found' });
    return doc;
  }

  async move(id: string, input: MoveOpportunityInput): Promise<OpportunityDocument> {
    const doc = await this.byId(id);
    doc.stage = input.stage;
    doc.position = input.position;
    return doc.save();
  }

  async remove(id: string): Promise<void> {
    const doc = await this.byId(id);
    doc.deletedAt = new Date();
    await doc.save();
  }
}
