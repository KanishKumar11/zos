// AttendanceService — check-in/out, admin marking, monthly summaries.
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  AttendanceStatus,
  type AdminMarkAttendanceInput,
  type TeamAttendanceQuery,
} from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';
import { ymd } from '@/common/utils/date.util';

import { HolidaysService } from '../holidays/holidays.service';
import { SettingsService } from '../settings/settings.service';
import {
  AttendanceEntry,
  type AttendanceEntryDocument,
} from './schemas/attendance-entry.schema';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(AttendanceEntry.name)
    private readonly model: Model<AttendanceEntryDocument>,
    private readonly settings: SettingsService,
    private readonly holidays: HolidaysService,
  ) {}

  async checkIn(userId: string, note?: string): Promise<AttendanceEntryDocument> {
    const today = ymd(new Date());
    const existing = await this.model.findOne({ userId, date: today }).exec();
    if (existing && existing.checkInAt) {
      throw new ConflictException({ code: ErrorCodes.CONFLICT, message: 'Already checked in today' });
    }
    if (existing) {
      existing.checkInAt = new Date();
      existing.status = AttendanceStatus.PRESENT;
      if (note) existing.note = note;
      return existing.save();
    }
    return this.model.create({
      userId: new Types.ObjectId(userId),
      date: today,
      status: AttendanceStatus.PRESENT,
      checkInAt: new Date(),
      note,
    });
  }

  async checkOut(userId: string, note?: string): Promise<AttendanceEntryDocument> {
    const today = ymd(new Date());
    const entry = await this.model.findOne({ userId, date: today }).exec();
    if (!entry || !entry.checkInAt) {
      throw new ConflictException({ code: ErrorCodes.CONFLICT, message: 'Not checked in today' });
    }
    entry.checkOutAt = new Date();
    entry.workedMinutes = Math.max(
      0,
      Math.round((entry.checkOutAt.getTime() - entry.checkInAt.getTime()) / 60000),
    );
    if (note) entry.note = note;
    return entry.save();
  }

  monthFor(userId: string, monthYYYYMM: string): Promise<AttendanceEntryDocument[]> {
    const [y, m] = monthYYYYMM.split('-').map(Number);
    const start = `${monthYYYYMM}-01`;
    const endMonth = m === 12 ? 1 : m + 1;
    const endYear = m === 12 ? y + 1 : y;
    const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
    return this.model.find({ userId, date: { $gte: start, $lt: end } }).sort({ date: 1 }).exec();
  }

  team(query: TeamAttendanceQuery): Promise<AttendanceEntryDocument[]> {
    const filter: Record<string, unknown> = { date: query.date };
    return this.model.find(filter).exec();
  }

  async adminMark(input: AdminMarkAttendanceInput, actorId: string): Promise<AttendanceEntryDocument> {
    const entry = await this.model.findOneAndUpdate(
      { userId: input.userId, date: input.date },
      {
        userId: new Types.ObjectId(input.userId),
        date: input.date,
        status: input.status,
        workedMinutes: input.workedMinutes ?? 0,
        note: input.note,
        markedBy: new Types.ObjectId(actorId),
      },
      { upsert: true, new: true },
    );
    return entry!;
  }

  /** Used by payroll computation: returns count of PRESENT/HALF_DAY days for [start,endExclusive). */
  async workingDaysFor(userId: string, start: Date, endExclusive: Date): Promise<{ present: number; halfDay: number; total: number }> {
    const docs = await this.model.find({
      userId,
      date: { $gte: ymd(start), $lt: ymd(endExclusive) },
    }).exec();
    let present = 0;
    let halfDay = 0;
    for (const d of docs) {
      if (d.status === AttendanceStatus.PRESENT) present++;
      else if (d.status === AttendanceStatus.HALF_DAY) halfDay++;
    }
    const settings = await this.settings.get();
    const weekend = new Set(settings.weekendDays);
    const holidaySet = await this.holidays.holidayDateSet(start, endExclusive);
    let total = 0;
    for (let d = new Date(start); d < endExclusive; d.setDate(d.getDate() + 1)) {
      if (weekend.has(d.getDay())) continue;
      if (holidaySet.has(ymd(d))) continue;
      total++;
    }
    return { present, halfDay, total };
  }
}
