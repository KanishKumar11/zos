// ClientsService — OWNER-only.
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import type { CreateClientInput, UpdateClientInput } from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';

import { Client, type ClientDocument } from './schemas/client.schema';

@Injectable()
export class ClientsService {
  constructor(@InjectModel(Client.name) private readonly model: Model<ClientDocument>) {}

  list(search?: string): Promise<ClientDocument[]> {
    const filter: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (search) filter.name = { $regex: search, $options: 'i' };
    return this.model.find(filter).sort({ name: 1 }).limit(500).exec();
  }

  async byId(id: string): Promise<ClientDocument> {
    const doc = await this.model.findOne({ _id: id, deletedAt: { $exists: false } }).exec();
    if (!doc)
      throw new NotFoundException({
        code: ErrorCodes.CLIENT_NOT_FOUND,
        message: 'Client not found',
      });
    return doc;
  }

  create(input: CreateClientInput): Promise<ClientDocument> {
    return this.model.create(input);
  }

  async update(id: string, input: UpdateClientInput): Promise<ClientDocument> {
    const doc = await this.model.findByIdAndUpdate(id, input, { new: true }).exec();
    if (!doc)
      throw new NotFoundException({
        code: ErrorCodes.CLIENT_NOT_FOUND,
        message: 'Client not found',
      });
    return doc;
  }

  async remove(id: string): Promise<void> {
    const doc = await this.byId(id);
    doc.deletedAt = new Date();
    await doc.save();
  }
}
