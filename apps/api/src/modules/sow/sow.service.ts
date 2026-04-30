// SowService — OWNER-only resource.
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import type {
  CreateSowInput,
  SowBriefInput,
  SowDocumentInput,
  UpdateSowInput,
} from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';

import { Sow, type SowDocument } from './schemas/sow.schema';

@Injectable()
export class SowService {
  constructor(@InjectModel(Sow.name) private readonly model: Model<SowDocument>) {}

  list(filter: { clientId?: string; projectId?: string } = {}): Promise<SowDocument[]> {
    const q: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (filter.clientId) q.clientId = new Types.ObjectId(filter.clientId);
    if (filter.projectId) q.projectId = new Types.ObjectId(filter.projectId);
    return this.model.find(q).sort({ createdAt: -1 }).exec();
  }

  async byId(id: string): Promise<SowDocument> {
    const doc = await this.model.findOne({ _id: id, deletedAt: { $exists: false } }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.SOW_NOT_FOUND, message: 'SOW not found' });
    return doc;
  }

  create(input: CreateSowInput): Promise<SowDocument> {
    return this.model.create({
      ...input,
      clientId: new Types.ObjectId(input.clientId),
      projectId: input.projectId ? new Types.ObjectId(input.projectId) : undefined,
      currency: input.currency ?? 'INR',
    });
  }

  async update(id: string, input: UpdateSowInput): Promise<SowDocument> {
    const doc = await this.model.findByIdAndUpdate(id, input, { new: true }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.SOW_NOT_FOUND, message: 'SOW not found' });
    return doc;
  }

  async remove(id: string): Promise<void> {
    const doc = await this.byId(id);
    doc.deletedAt = new Date();
    await doc.save();
  }

  async setBrief(id: string, input: SowBriefInput, actorId: string): Promise<SowDocument> {
    const doc = await this.byId(id);
    doc.brief = {
      scopeSummary: input.scopeSummary,
      deliverables: input.deliverables,
      timelineStart: input.timelineStart ? new Date(input.timelineStart) : undefined,
      timelineEnd: input.timelineEnd ? new Date(input.timelineEnd) : undefined,
      revisionRounds: input.revisionRounds ?? 0,
      publishedAt: new Date(),
      publishedBy: new Types.ObjectId(actorId),
    } as never;
    await doc.save();
    return doc;
  }

  async getBrief(id: string): Promise<SowDocument['brief']> {
    const doc = await this.byId(id);
    if (!doc.brief) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Brief not published yet' });
    }
    return doc.brief;
  }

  async setDocument(id: string, input: SowDocumentInput): Promise<SowDocument> {
    const doc = await this.byId(id);
    doc.documentKey = input.key;
    await doc.save();
    return doc;
  }
}
