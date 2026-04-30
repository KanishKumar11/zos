// Repository for users — owns Mongoose access. Service layer never touches the model directly.
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type FilterQuery, Model, Types } from 'mongoose';

import { User, type UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersRepository {
  constructor(@InjectModel(User.name) private readonly model: Model<UserDocument>) {}

  byEmail(email: string): Promise<UserDocument | null> {
    return this.model.findOne({ email: email.toLowerCase(), deletedAt: { $exists: false } }).exec();
  }

  byId(id: string): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(id)) return Promise.resolve(null);
    return this.model.findOne({ _id: id, deletedAt: { $exists: false } }).exec();
  }

  create(input: Partial<User>): Promise<UserDocument> {
    return this.model.create(input);
  }

  update(id: string, patch: Partial<User>): Promise<UserDocument | null> {
    return this.model.findByIdAndUpdate(id, patch, { new: true }).exec();
  }

  count(filter: FilterQuery<UserDocument> = {}): Promise<number> {
    return this.model.countDocuments({ ...filter, deletedAt: { $exists: false } }).exec();
  }

  list(
    filter: FilterQuery<UserDocument>,
    opts: { skip?: number; limit?: number; sort?: Record<string, 1 | -1> } = {},
  ): Promise<UserDocument[]> {
    return this.model
      .find({ ...filter, deletedAt: { $exists: false } })
      .skip(opts.skip ?? 0)
      .limit(opts.limit ?? 20)
      .sort(opts.sort ?? { createdAt: -1 })
      .exec();
  }

  softDelete(id: string): Promise<UserDocument | null> {
    return this.model.findByIdAndUpdate(id, { deletedAt: new Date() }, { new: true }).exec();
  }

  bumpTokenVersion(id: string): Promise<UserDocument | null> {
    return this.model.findByIdAndUpdate(id, { $inc: { tokenVersion: 1 } }, { new: true }).exec();
  }
}
