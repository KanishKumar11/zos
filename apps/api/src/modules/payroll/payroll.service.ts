// PayrollService — create draft, compute payslips, finalize.
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  EVENT_NAMES,
  PayrollStatus,
  UserStatus,
  type CreatePayrollRunInput,
  type FinalizePayrollRunInput,
} from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';

import { AttendanceService } from '../attendance/attendance.service';
import { CompensationService } from '../compensation/compensation.service';
import { UsersRepository } from '../users/users.repository';
import { PayrollRun, type PayrollRunDocument } from './schemas/payroll-run.schema';
import { Payslip, type PayslipDocument } from './schemas/payslip.schema';

@Injectable()
export class PayrollService {
  constructor(
    @InjectModel(PayrollRun.name) private readonly runs: Model<PayrollRunDocument>,
    @InjectModel(Payslip.name) private readonly slips: Model<PayslipDocument>,
    private readonly users: UsersRepository,
    private readonly compensation: CompensationService,
    private readonly attendance: AttendanceService,
    private readonly events: EventEmitter2,
  ) {}

  list(): Promise<PayrollRunDocument[]> {
    return this.runs.find().sort({ month: -1 }).exec();
  }

  async byId(id: string): Promise<PayrollRunDocument> {
    const run = await this.runs.findById(id).exec();
    if (!run) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Payroll run not found' });
    return run;
  }

  payslipsFor(runId: string): Promise<PayslipDocument[]> {
    return this.slips.find({ runId }).exec();
  }

  myPayslips(userId: string): Promise<PayslipDocument[]> {
    return this.slips.find({ userId }).sort({ month: -1 }).exec();
  }

  async create(input: CreatePayrollRunInput, actorId: string): Promise<PayrollRunDocument> {
    const existing = await this.runs.findOne({ month: input.month }).exec();
    if (existing) {
      throw new ConflictException({
        code: ErrorCodes.CONFLICT,
        message: `Payroll run already exists for ${input.month}`,
      });
    }
    const run = await this.runs.create({
      month: input.month,
      status: PayrollStatus.DRAFT,
      notes: input.notes,
      createdBy: new Types.ObjectId(actorId),
    });
    await this.computePayslips(run);
    this.events.emit(EVENT_NAMES.payroll.runCreated, { runId: run.id, month: run.month });
    return run;
  }

  /** Recompute payslips for an existing draft run. */
  async recompute(runId: string): Promise<PayrollRunDocument> {
    const run = await this.byId(runId);
    if (run.status === PayrollStatus.FINALIZED) {
      throw new ConflictException({ code: ErrorCodes.PAYROLL_RUN_LOCKED, message: 'Run is finalized' });
    }
    await this.slips.deleteMany({ runId: run._id }).exec();
    await this.computePayslips(run);
    return run;
  }

  async finalize(
    runId: string,
    actorId: string,
    input: FinalizePayrollRunInput,
  ): Promise<PayrollRunDocument> {
    const run = await this.byId(runId);
    if (run.status === PayrollStatus.FINALIZED) {
      throw new ConflictException({ code: ErrorCodes.PAYROLL_RUN_LOCKED, message: 'Already finalized' });
    }
    run.status = PayrollStatus.FINALIZED;
    run.finalizedBy = new Types.ObjectId(actorId);
    run.finalizedAt = new Date();
    if (input.notes) run.notes = input.notes;
    await run.save();
    this.events.emit(EVENT_NAMES.payroll.runFinalized, { runId: run.id, month: run.month });
    return run;
  }

  // -- internals -----------------------------------------------------------

  private monthBoundaries(month: string): { start: Date; endExclusive: Date } {
    const [y, m] = month.split('-').map(Number);
    return {
      start: new Date(Date.UTC(y, m - 1, 1)),
      endExclusive: new Date(Date.UTC(y, m, 1)),
    };
  }

  private async computePayslips(run: PayrollRunDocument): Promise<void> {
    const { start, endExclusive } = this.monthBoundaries(run.month);
    const activeUsers = await this.users.list({ status: UserStatus.ACTIVE }, { limit: 5000 });
    let totalNet = 0;
    let count = 0;
    for (const user of activeUsers) {
      const profile = await this.compensation.byUserId(user.id);
      if (!profile) continue;
      const att = await this.attendance.workingDaysFor(user.id, start, endExclusive);
      const present = att.present + att.halfDay * 0.5;
      const lopDays = Math.max(0, att.total - present);
      const perDay = att.total > 0 ? Math.round(profile.baseAmount / att.total) : 0;
      const lopDeduction = Math.round(perDay * lopDays);
      const gross = profile.baseAmount + profile.hra + profile.specialAllowance;
      const deductions =
        lopDeduction +
        profile.providentFundEmployee +
        profile.professionalTax +
        profile.tdsMonthly;
      const netPaise = Math.max(0, gross - deductions);

      await this.slips.findOneAndUpdate(
        { runId: run._id, userId: user._id },
        {
          runId: run._id,
          month: run.month,
          userId: user._id,
          breakdown: {
            baseAmount: profile.baseAmount,
            hra: profile.hra,
            specialAllowance: profile.specialAllowance,
            lopDeduction,
            providentFundEmployee: profile.providentFundEmployee,
            professionalTax: profile.professionalTax,
            tdsMonthly: profile.tdsMonthly,
          },
          grossPaise: gross,
          deductionsPaise: deductions,
          netPaise,
          workingDays: att.total,
          presentDays: Math.round(present * 10) / 10,
          lopDays: Math.round(lopDays * 10) / 10,
          currency: profile.currency,
        },
        { upsert: true, new: true },
      );
      totalNet += netPaise;
      count++;
    }
    run.totalNetPaise = totalNet;
    run.employeeCount = count;
    await run.save();
  }
}
