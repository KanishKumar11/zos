// HolidaysService — list filtered by year, CRUD.
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import type { CreateHolidayInput, UpdateHolidayInput } from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';

import { Holiday, type HolidayDocument } from './schemas/holiday.schema';

@Injectable()
export class HolidaysService {
  constructor(@InjectModel(Holiday.name) private readonly model: Model<HolidayDocument>) {}

  list(year?: number): Promise<HolidayDocument[]> {
    if (!year) return this.model.find().sort({ date: 1 }).exec();
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));
    return this.model.find({ date: { $gte: start, $lt: end } }).sort({ date: 1 }).exec();
  }

  async create(input: CreateHolidayInput): Promise<HolidayDocument> {
    try {
      return await this.model.create({ ...input, date: new Date(input.date) });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictException({ code: ErrorCodes.CONFLICT, message: 'Holiday already exists for that date' });
      }
      throw err;
    }
  }

  async update(id: string, patch: UpdateHolidayInput): Promise<HolidayDocument> {
    const doc = await this.model
      .findByIdAndUpdate(id, { ...patch, ...(patch.date ? { date: new Date(patch.date) } : {}) }, { new: true })
      .exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Holiday not found' });
    return doc;
  }

  async remove(id: string): Promise<{ ok: boolean }> {
    const doc = await this.model.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Holiday not found' });
    return { ok: true };
  }

  /** Used by attendance/payroll: returns YYYY-MM-DD set for a date range. */
  async holidayDateSet(start: Date, endExclusive: Date): Promise<Set<string>> {
    const docs = await this.model.find({ date: { $gte: start, $lt: endExclusive } }).exec();
    return new Set(docs.map((d) => d.date.toISOString().slice(0, 10)));
  }
}
