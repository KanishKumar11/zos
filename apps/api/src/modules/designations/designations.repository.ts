// Repository for designations.
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Designation, type DesignationDocument } from './schemas/designation.schema';

@Injectable()
export class DesignationsRepository {
  constructor(@InjectModel(Designation.name) private readonly model: Model<DesignationDocument>) {}

  list(filter: { departmentId?: string } = {}): Promise<DesignationDocument[]> {
    const q: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (filter.departmentId && Types.ObjectId.isValid(filter.departmentId)) {
      q.departmentId = new Types.ObjectId(filter.departmentId);
    }
    return this.model.find(q).sort({ title: 1 }).exec();
  }

  byId(id: string): Promise<DesignationDocument | null> {
    if (!Types.ObjectId.isValid(id)) return Promise.resolve(null);
    return this.model.findOne({ _id: id, deletedAt: { $exists: false } }).exec();
  }

  byTitleInDept(title: string, departmentId: string): Promise<DesignationDocument | null> {
    if (!Types.ObjectId.isValid(departmentId)) return Promise.resolve(null);
    return this.model.findOne({ title, departmentId, deletedAt: { $exists: false } }).exec();
  }

  create(input: Partial<Designation>): Promise<DesignationDocument> {
    return this.model.create(input);
  }

  update(id: string, patch: Partial<Designation>): Promise<DesignationDocument | null> {
    return this.model.findByIdAndUpdate(id, patch, { new: true }).exec();
  }

  softDelete(id: string): Promise<DesignationDocument | null> {
    return this.model.findByIdAndUpdate(id, { deletedAt: new Date() }, { new: true }).exec();
  }
}
