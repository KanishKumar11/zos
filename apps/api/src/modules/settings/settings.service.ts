// SettingsService — singleton get/update with auto-bootstrap.
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import type { UpdateSettingsInput } from '@agency/shared';

import { Settings, type SettingsDocument } from './schemas/settings.schema';

@Injectable()
export class SettingsService {
  constructor(@InjectModel(Settings.name) private readonly model: Model<SettingsDocument>) {}

  async get(): Promise<SettingsDocument> {
    const existing = await this.model.findOne({ key: 'workspace' }).exec();
    if (existing) return existing;
    return this.model.create({ key: 'workspace', workspaceName: 'My Agency', defaultCurrency: 'INR' });
  }

  async update(patch: UpdateSettingsInput): Promise<SettingsDocument> {
    return (await this.model
      .findOneAndUpdate({ key: 'workspace' }, patch, { new: true, upsert: true })
      .exec())!;
  }
}
