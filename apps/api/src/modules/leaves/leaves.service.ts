// LeavesService — request/decide/cancel + balance bookkeeping.
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  EVENT_NAMES,
  LeaveStatus,
  LeaveType,
  type DecideLeaveInput,
  type RequestLeaveInput,
} from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';
import { inclusiveDayCount, ymd } from '@/common/utils/date.util';

import { HolidaysService } from '../holidays/holidays.service';
import { SettingsService } from '../settings/settings.service';
import { LeaveBalance, type LeaveBalanceDocument } from './schemas/leave-balance.schema';
import { LeaveRequest, type LeaveRequestDocument } from './schemas/leave-request.schema';

@Injectable()
export class LeavesService {
  constructor(
    @InjectModel(LeaveRequest.name) private readonly requests: Model<LeaveRequestDocument>,
    @InjectModel(LeaveBalance.name) private readonly balances: Model<LeaveBalanceDocument>,
    private readonly settings: SettingsService,
    private readonly holidays: HolidaysService,
    private readonly events: EventEmitter2,
  ) {}

  myRequests(userId: string): Promise<LeaveRequestDocument[]> {
    return this.requests.find({ userId }).sort({ createdAt: -1 }).exec();
  }

  pending(): Promise<LeaveRequestDocument[]> {
    return this.requests.find({ status: LeaveStatus.PENDING }).sort({ createdAt: 1 }).exec();
  }

  async balanceFor(userId: string, year: number = new Date().getFullYear()): Promise<LeaveBalanceDocument> {
    let bal = await this.balances.findOne({ userId, year }).exec();
    if (!bal) {
      const settings = await this.settings.get();
      bal = await this.balances.create({
        userId: new Types.ObjectId(userId),
        year,
        annualEntitlement: settings.annualLeavePerYear,
        sickEntitlement: settings.sickLeavePerYear,
      });
    }
    return bal;
  }

  async request(userId: string, input: RequestLeaveInput): Promise<LeaveRequestDocument> {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    const settings = await this.settings.get();
    const weekend = new Set(settings.weekendDays);
    const holidaySet = await this.holidays.holidayDateSet(start, new Date(end.getTime() + 86400000));
    let days = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (weekend.has(d.getDay())) continue;
      if (holidaySet.has(ymd(d))) continue;
      days++;
    }
    if (days <= 0) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Selected dates contain no working days',
      });
    }

    if (input.type === LeaveType.ANNUAL || input.type === LeaveType.SICK) {
      const balance = await this.balanceFor(userId, start.getFullYear());
      const remaining =
        input.type === LeaveType.ANNUAL
          ? balance.annualEntitlement - balance.annualUsed
          : balance.sickEntitlement - balance.sickUsed;
      if (days > remaining) {
        throw new ConflictException({
          code: ErrorCodes.INSUFFICIENT_LEAVE_BALANCE,
          message: `Only ${remaining} day(s) remaining in your ${input.type.toLowerCase()} balance`,
        });
      }
    }

    const doc = await this.requests.create({
      userId: new Types.ObjectId(userId),
      type: input.type,
      startDate: start,
      endDate: end,
      days,
      reason: input.reason,
      status: LeaveStatus.PENDING,
    });
    this.events.emit(EVENT_NAMES.leave.requested, { leaveId: doc.id, userId });
    return doc;
  }

  async decide(
    leaveId: string,
    actorId: string,
    input: DecideLeaveInput,
  ): Promise<LeaveRequestDocument> {
    const req = await this.requests.findById(leaveId).exec();
    if (!req) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Leave request not found' });
    if (req.status !== LeaveStatus.PENDING) {
      throw new ConflictException({ code: ErrorCodes.CONFLICT, message: 'Already decided' });
    }
    req.status = input.approve ? LeaveStatus.APPROVED : LeaveStatus.REJECTED;
    req.decidedBy = new Types.ObjectId(actorId);
    req.decidedAt = new Date();
    req.decisionNote = input.note;
    await req.save();

    if (input.approve && (req.type === LeaveType.ANNUAL || req.type === LeaveType.SICK)) {
      const year = req.startDate.getFullYear();
      const balance = await this.balanceFor(req.userId.toString(), year);
      if (req.type === LeaveType.ANNUAL) balance.annualUsed += req.days;
      else balance.sickUsed += req.days;
      await balance.save();
    }
    this.events.emit(input.approve ? EVENT_NAMES.leave.approved : EVENT_NAMES.leave.rejected, {
      leaveId: req.id,
      userId: req.userId.toString(),
    });
    return req;
  }

  async cancel(leaveId: string, actorId: string): Promise<LeaveRequestDocument> {
    const req = await this.requests.findById(leaveId).exec();
    if (!req) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Leave request not found' });
    if (req.userId.toString() !== actorId) {
      throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: 'Not your leave request' });
    }
    if (req.status === LeaveStatus.CANCELLED) return req;
    if (req.status === LeaveStatus.APPROVED && (req.type === LeaveType.ANNUAL || req.type === LeaveType.SICK)) {
      const balance = await this.balanceFor(req.userId.toString(), req.startDate.getFullYear());
      if (req.type === LeaveType.ANNUAL) balance.annualUsed = Math.max(0, balance.annualUsed - req.days);
      else balance.sickUsed = Math.max(0, balance.sickUsed - req.days);
      await balance.save();
    }
    req.status = LeaveStatus.CANCELLED;
    await req.save();
    return req;
  }

  /** Fallback util used by other modules. */
  computeWorkingDays(start: Date, end: Date): number {
    return inclusiveDayCount(start, end);
  }
}
