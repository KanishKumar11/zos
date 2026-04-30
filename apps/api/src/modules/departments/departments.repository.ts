// Repository for departments.
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Department, type DepartmentDocument } from './schemas/department.schema';

@Injectable()
export class DepartmentsRepository {
  constructor(@InjectModel(Department.name) private readonly model: Model<DepartmentDocument>) {}

  list(): Promise<DepartmentDocument[]> {
    return this.model.find({ deletedAt: { $exists: false } }).sort({ name: 1 }).exec();
  }

  byId(id: string): Promise<DepartmentDocument | null> {
    if (!Types.ObjectId.isValid(id)) return Promise.resolve(null);
    return this.model.findOne({ _id: id, deletedAt: { $exists: false } }).exec();
  }

  byName(name: string): Promise<DepartmentDocument | null> {
    return this.model.findOne({ name, deletedAt: { $exists: false } }).exec();
  }

  create(input: Partial<Department>): Promise<DepartmentDocument> {
    return this.model.create(input);
  }

  update(id: string, patch: Partial<Department>): Promise<DepartmentDocument | null> {
    return this.model.findByIdAndUpdate(id, patch, { new: true }).exec();
  }

  softDelete(id: string): Promise<DepartmentDocument | null> {
    return this.model.findByIdAndUpdate(id, { deletedAt: new Date() }, { new: true }).exec();
  }
}
