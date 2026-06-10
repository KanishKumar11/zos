// PayrollService — create draft, compute payslips, finalize, adjustments, PDFs.
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  EVENT_NAMES,
  NotificationType,
  PayrollStatus,
  UserStatus,
  type CreatePayrollRunInput,
  type FinalizePayrollRunInput,
} from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';

import { AttendanceService } from '../attendance/attendance.service';
import { CompensationService } from '../compensation/compensation.service';
import { PdfService } from '../pdf/pdf.service';
import { SettingsService } from '../settings/settings.service';
import { StorageService } from '../storage/storage.service';
import { UsersRepository } from '../users/users.repository';
import { PayrollRun, type PayrollRunDocument } from './schemas/payroll-run.schema';
import { Payslip, type PayslipDocument } from './schemas/payslip.schema';
import { renderPayslipHtml } from './templates/payslip.template';

export interface AddAdjustmentInput {
  kind: 'BONUS' | 'DEDUCTION';
  reason: string;
  amountPaise: number;
}

@Injectable()
export class PayrollService {
  constructor(
    @InjectModel(PayrollRun.name) private readonly runs: Model<PayrollRunDocument>,
    @InjectModel(Payslip.name) private readonly slips: Model<PayslipDocument>,
    private readonly users: UsersRepository,
    private readonly compensation: CompensationService,
    private readonly attendance: AttendanceService,
    private readonly events: EventEmitter2,
    private readonly pdf: PdfService,
    private readonly storage: StorageService,
    private readonly settings: SettingsService,
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

  payslipsByIds(ids: string[]): Promise<PayslipDocument[]> {
    return this.slips.find({ _id: { $in: ids } }).exec();
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
    await this.fanoutFinalized(run.id);
    return run;
  }

  // -- internals -----------------------------------------------------------

  private monthBoundaries(month: string): { start: Date; endExclusive: Date } {
    const [y, m] = month.split('-').map(Number);
    if (!y || !m) {
      throw new Error(`Invalid month format: ${month}`);
    }
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
      // Preserve existing manual adjustments if a payslip already exists.
      const existing = await this.slips.findOne({ runId: run._id, userId: user._id }).exec();
      const adjustments = existing?.adjustments ?? [];
      const bonusPaise = adjustments.filter((a) => a.kind === 'BONUS').reduce((s, a) => s + a.amountPaise, 0);
      const manualDeductionPaise = adjustments.filter((a) => a.kind === 'DEDUCTION').reduce((s, a) => s + a.amountPaise, 0);
      const gross = profile.baseAmount + profile.hra + profile.specialAllowance + bonusPaise;
      const deductions =
        lopDeduction +
        profile.providentFundEmployee +
        profile.professionalTax +
        profile.tdsMonthly +
        manualDeductionPaise;
      const netPaise = Math.max(0, gross - deductions);

      await this.slips.findOneAndUpdate(
        { runId: run._id, userId: user._id },
        {
          $set: {
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
              lateDeduction: 0,
              bonusPaise,
              manualDeductionPaise,
            },
            grossPaise: gross,
            deductionsPaise: deductions,
            netPaise,
            workingDays: att.total,
            presentDays: Math.round(present * 10) / 10,
            lopDays: Math.round(lopDays * 10) / 10,
            currency: profile.currency,
            adjustments,
          },
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

  // -- Adjustments (manual bonus/deduction) --------------------------------

  async addAdjustment(payslipId: string, input: AddAdjustmentInput): Promise<PayslipDocument> {
    const slip = await this.slips.findById(payslipId).exec();
    if (!slip) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Payslip not found' });
    const run = await this.runs.findById(slip.runId).exec();
    if (run?.status === PayrollStatus.FINALIZED) {
      throw new ConflictException({ code: ErrorCodes.PAYROLL_RUN_LOCKED, message: 'Run is finalized' });
    }
    if (input.amountPaise <= 0) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_FAILED, message: 'amountPaise must be positive' });
    }
    slip.adjustments.push(input as never);
    await slip.save();
    if (run) await this.recompute(run.id);
    return (await this.slips.findById(payslipId).exec())!;
  }

  async removeAdjustment(payslipId: string, idx: number): Promise<PayslipDocument> {
    const slip = await this.slips.findById(payslipId).exec();
    if (!slip) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Payslip not found' });
    const run = await this.runs.findById(slip.runId).exec();
    if (run?.status === PayrollStatus.FINALIZED) {
      throw new ConflictException({ code: ErrorCodes.PAYROLL_RUN_LOCKED, message: 'Run is finalized' });
    }
    if (idx < 0 || idx >= slip.adjustments.length) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_FAILED, message: 'Invalid adjustment index' });
    }
    slip.adjustments.splice(idx, 1);
    await slip.save();
    if (run) await this.recompute(run.id);
    return (await this.slips.findById(payslipId).exec())!;
  }

  // -- PDF -----------------------------------------------------------------

  async payslipPdf(payslipId: string): Promise<{ buffer: Buffer; filename: string }> {
    const slip = await this.slips.findById(payslipId).exec();
    if (!slip) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Payslip not found' });
    const user = await this.users.byId(slip.userId.toString());
    if (!user) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'User not found' });
    const settings = await this.settings.get();
    const html = renderPayslipHtml({
      agency: {
        name: settings.workspaceName,
        address: [settings.addressLine1, settings.city, settings.state].filter(Boolean).join(', ') || undefined,
        gstin: settings.gstin,
      },
      employee: {
        name: user.name,
        email: user.email,
        bankLast4: user.bankDetails?.accountNumberLast4,
      },
      month: slip.month,
      workingDays: slip.workingDays,
      presentDays: slip.presentDays,
      lopDays: slip.lopDays,
      currency: slip.currency,
      lines: [
        { label: 'Basic', value: slip.breakdown.baseAmount, kind: 'earning' },
        { label: 'HRA', value: slip.breakdown.hra, kind: 'earning' },
        { label: 'Special Allowance', value: slip.breakdown.specialAllowance, kind: 'earning' },
        ...(slip.breakdown.bonusPaise ? [{ label: 'Bonus', value: slip.breakdown.bonusPaise, kind: 'earning' as const }] : []),
        { label: 'PF (Employee)', value: slip.breakdown.providentFundEmployee, kind: 'deduction' },
        { label: 'Professional Tax', value: slip.breakdown.professionalTax, kind: 'deduction' },
        { label: 'TDS', value: slip.breakdown.tdsMonthly, kind: 'deduction' },
        { label: 'LOP', value: slip.breakdown.lopDeduction, kind: 'deduction' },
        ...(slip.breakdown.manualDeductionPaise
          ? [{ label: 'Other Deductions', value: slip.breakdown.manualDeductionPaise, kind: 'deduction' as const }]
          : []),
      ],
      grossPaise: slip.grossPaise,
      deductionsPaise: slip.deductionsPaise,
      netPaise: slip.netPaise,
    });
    const buffer = await this.pdf.renderPdf(html);
    const filename = `payslip-${slip.month}-${user.name.replace(/\s+/g, '_')}.pdf`;
    // Best-effort upload + cache key on the slip.
    try {
      const key = `payslips/${slip.month}/${slip.id}.pdf`;
      await this.storage.putBuffer(key, buffer, 'application/pdf');
      slip.pdfKey = key;
      await slip.save();
    } catch {
      // S3 failures shouldn't block the download.
    }
    return { buffer, filename };
  }

  /** Fanout PAYSLIP_GENERATED notifications when a run is finalized. */
  private async fanoutFinalized(runId: string): Promise<void> {
    const slips = await this.slips.find({ runId: new Types.ObjectId(runId) }).exec();
    for (const s of slips) {
      this.events.emit(EVENT_NAMES.notification.create, {
        userId: s.userId.toString(),
        type: NotificationType.PAYSLIP_GENERATED,
        title: `Payslip ready for ${s.month}`,
        body: `Net pay ${(s.netPaise / 100).toFixed(2)} ${s.currency}`,
        linkPath: `/payroll`,
        data: { payslipId: s.id, month: s.month },
      });
      this.events.emit(EVENT_NAMES.payroll.payslipReady, { payslipId: s.id, userId: s.userId.toString() });
    }
  }
}
