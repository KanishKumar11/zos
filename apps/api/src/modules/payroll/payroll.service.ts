// PayrollService — draft runs, payslip computation, adjustments, finalize / pay / reopen, PDFs.
//
// Payslips are upserted per (run, person), so recomputing keeps their ids and their manual
// adjustments. Only payslips of people who are no longer eligible are removed.
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  AuditAction,
  CompensationType,
  EVENT_NAMES,
  NotificationType,
  PayrollSkipReason,
  PayrollStatus,
  Role,
  SIGN_IN_STATUSES,
  type CreatePayrollRunInput,
  type FinalizePayrollRunInput,
  type MarkPayrollPaidInput,
} from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';
import { emitAudit } from '@/common/utils/audit.util';

import { AttendanceService } from '../attendance/attendance.service';
import { CompensationService, type CompensationTerms } from '../compensation/compensation.service';
import { HolidaysService } from '../holidays/holidays.service';
import { PdfService } from '../pdf/pdf.service';
import { SettingsService } from '../settings/settings.service';
import { StorageService } from '../storage/storage.service';
import { User, type UserDocument } from '../users/schemas/user.schema';
import { UsersRepository } from '../users/users.repository';
import { lopDeduction, summarizeAttendance, todayIn, totalsFor } from './payroll-calc';
import { PayrollRun, type PayrollRunDocument } from './schemas/payroll-run.schema';
import { Payslip, type PayslipDocument } from './schemas/payslip.schema';
import { renderPayslipHtml } from './templates/payslip.template';

export interface AddAdjustmentInput {
  kind: 'BONUS' | 'DEDUCTION';
  reason: string;
  amountPaise: number;
}

/** Everything about the month that is the same for every person. */
interface MonthContext {
  month: string;
  start: Date;
  endExclusive: Date;
  startYmd: string;
  endYmdExclusive: string;
  today: string;
  weekendDays: number[];
  holidays: Set<string>;
  treatMissingAsAbsent: boolean;
}

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const monthLabel = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, 1)).toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

@Injectable()
export class PayrollService {
  constructor(
    @InjectModel(PayrollRun.name) private readonly runs: Model<PayrollRunDocument>,
    @InjectModel(Payslip.name) private readonly slips: Model<PayslipDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly users: UsersRepository,
    private readonly compensation: CompensationService,
    private readonly attendance: AttendanceService,
    private readonly holidays: HolidaysService,
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

  /** Payslips of a run with the person's name attached ("Deleted member" when they're gone). */
  async payslipsFor(runId: string): Promise<Record<string, unknown>[]> {
    const slips = await this.slips.find({ runId: new Types.ObjectId(runId) }).exec();
    const people = await this.peopleById(slips.map((s) => s.userId.toString()));
    return slips
      .map((s) => {
        const u = people.get(s.userId.toString());
        return { ...s.toJSON(), userName: u?.name ?? 'Deleted member', userEmail: u?.email, userStatus: u?.status };
      })
      .sort((a, b) => String(a.userName).localeCompare(String(b.userName)));
  }

  /** Bank-transfer rows for a run (OWNER only — bank details are owner-only). */
  async bankExport(runId: string) {
    const run = await this.byId(runId);
    const slips = await this.slips.find({ runId: run._id }).exec();
    const people = await this.peopleById(slips.map((s) => s.userId.toString()));
    return slips
      .map((s) => {
        const u = people.get(s.userId.toString());
        return {
          payslipId: s.id as string,
          userId: s.userId.toString(),
          name: u?.name ?? 'Deleted member',
          email: u?.email,
          accountHolderName: u?.bankDetails?.accountHolderName,
          accountNumberLast4: u?.bankDetails?.accountNumberLast4,
          ifsc: u?.bankDetails?.ifsc,
          bankName: u?.bankDetails?.bankName,
          upiId: u?.bankDetails?.upiId,
          netPaise: s.netPaise,
          currency: s.currency,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Payslips of one person, newest first. `releasedOnly` (the person's own view) hides drafts —
   * numbers can still change until the run is finalized.
   */
  async myPayslips(userId: string, opts: { releasedOnly?: boolean } = {}): Promise<PayslipDocument[]> {
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (opts.releasedOnly) {
      const released = await this.runs
        .find({ status: { $in: [PayrollStatus.FINALIZED, PayrollStatus.PAID] } })
        .distinct('_id')
        .exec();
      filter.runId = { $in: released };
    }
    return this.slips.find(filter).sort({ month: -1 }).exec();
  }

  async isReleased(runId: string): Promise<boolean> {
    const run = await this.runs.findById(runId).select({ status: 1 }).lean().exec();
    return !!run && (run.status === PayrollStatus.FINALIZED || run.status === PayrollStatus.PAID);
  }

  payslipsByIds(ids: string[]): Promise<PayslipDocument[]> {
    return this.slips.find({ _id: { $in: ids } }).exec();
  }

  async create(input: CreatePayrollRunInput, actorId: string): Promise<PayrollRunDocument> {
    const existing = await this.runs.findOne({ month: input.month }).exec();
    if (existing) {
      throw new ConflictException({
        code: ErrorCodes.CONFLICT,
        message: `There is already a payroll run for ${monthLabel(input.month)}`,
      });
    }
    const run = await this.runs.create({
      month: input.month,
      status: PayrollStatus.DRAFT,
      notes: input.notes,
      createdBy: new Types.ObjectId(actorId),
    });
    await this.computeRun(run);
    this.events.emit(EVENT_NAMES.payroll.runCreated, { runId: run.id, month: run.month });
    return run;
  }

  /** Recompute every payslip of a draft run. Payslip ids and manual adjustments are kept. */
  async recompute(runId: string): Promise<PayrollRunDocument> {
    const run = await this.byId(runId);
    this.assertDraft(run);
    await this.computeRun(run);
    return run;
  }

  async finalize(runId: string, actorId: string, input: FinalizePayrollRunInput): Promise<PayrollRunDocument> {
    const run = await this.byId(runId);
    this.assertDraft(run);
    const count = await this.slips.countDocuments({ runId: run._id }).exec();
    if (count === 0) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_FAILED,
        message: 'This run has no payslips. Set up compensation for your team, then recompute.',
      });
    }
    run.status = PayrollStatus.FINALIZED;
    run.finalizedBy = new Types.ObjectId(actorId);
    run.finalizedAt = new Date();
    if (input.notes) run.notes = input.notes;
    await run.save();
    emitAudit(this.events, {
      actorId,
      action: AuditAction.PAYROLL_RUN_CONFIRMED,
      entity: 'payroll',
      entityId: run.id,
      summary: `${monthLabel(run.month)} payroll for ${run.employeeCount} people, ${rupees(run.totalNetPaise)} net`,
      after: { month: run.month, employeeCount: run.employeeCount, totalNetPaise: run.totalNetPaise },
    });
    this.events.emit(EVENT_NAMES.payroll.runFinalized, { runId: run.id, month: run.month });
    await this.fanoutFinalized(run.id);
    return run;
  }

  async markPaid(runId: string, actorId: string, input: MarkPayrollPaidInput): Promise<PayrollRunDocument> {
    const run = await this.byId(runId);
    if (run.status !== PayrollStatus.FINALIZED) {
      throw new ConflictException({
        code: ErrorCodes.CONFLICT,
        message: run.status === PayrollStatus.PAID ? 'This run is already marked paid' : 'Finalize the run before marking it paid',
      });
    }
    run.status = PayrollStatus.PAID;
    run.paidAt = input.paidAt ?? new Date();
    run.paidBy = new Types.ObjectId(actorId);
    if (input.notes) run.notes = input.notes;
    await run.save();
    emitAudit(this.events, {
      actorId,
      action: AuditAction.PAYROLL_RUN_PAID,
      entity: 'payroll',
      entityId: run.id,
      summary: `${monthLabel(run.month)} payroll paid, ${rupees(run.totalNetPaise)} to ${run.employeeCount} people`,
      after: { month: run.month, paidAt: run.paidAt },
    });
    return run;
  }

  /** OWNER only: unlock a finalized (not yet paid) run so it can be corrected. */
  async reopen(runId: string, actor: { sub: string; role: Role }): Promise<PayrollRunDocument> {
    const run = await this.byId(runId);
    if (actor.role !== Role.OWNER) {
      throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: 'Only the owner can reopen a payroll run' });
    }
    if (run.status !== PayrollStatus.FINALIZED) {
      throw new ConflictException({
        code: ErrorCodes.CONFLICT,
        message: run.status === PayrollStatus.PAID ? 'A paid run can’t be reopened' : 'This run is not finalized',
      });
    }
    const before = { status: run.status, finalizedAt: run.finalizedAt };
    run.status = PayrollStatus.DRAFT;
    run.finalizedAt = undefined;
    run.finalizedBy = undefined;
    run.reopenedAt = new Date();
    run.reopenedBy = new Types.ObjectId(actor.sub);
    await run.save();
    emitAudit(this.events, {
      actorId: actor.sub,
      action: AuditAction.PAYROLL_RUN_REOPENED,
      entity: 'payroll',
      entityId: run.id,
      summary: `Reopened ${monthLabel(run.month)} payroll`,
      before,
      after: { status: run.status },
    });
    return run;
  }

  // -- Adjustments (manual bonus/deduction) --------------------------------

  async addAdjustment(payslipId: string, input: AddAdjustmentInput): Promise<PayslipDocument> {
    const { slip, run } = await this.editableSlip(payslipId);
    if (input.amountPaise <= 0) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_FAILED, message: 'Amount must be more than zero' });
    }
    slip.adjustments.push({ kind: input.kind, reason: input.reason, amountPaise: input.amountPaise });
    return this.saveWithTotals(slip, run);
  }

  async removeAdjustment(payslipId: string, idx: number): Promise<PayslipDocument> {
    const { slip, run } = await this.editableSlip(payslipId);
    if (idx < 0 || idx >= slip.adjustments.length) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_FAILED, message: 'That adjustment no longer exists' });
    }
    slip.adjustments.splice(idx, 1);
    return this.saveWithTotals(slip, run);
  }

  // -- internals -----------------------------------------------------------

  private assertDraft(run: PayrollRunDocument): void {
    if (run.status !== PayrollStatus.DRAFT) {
      throw new ConflictException({
        code: ErrorCodes.PAYROLL_RUN_LOCKED,
        message: run.status === PayrollStatus.PAID ? 'This run is paid and locked' : 'This run is finalized and locked',
      });
    }
  }

  private async editableSlip(payslipId: string): Promise<{ slip: PayslipDocument; run: PayrollRunDocument }> {
    const slip = await this.slips.findById(payslipId).exec();
    if (!slip) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Payslip not found' });
    const run = await this.byId(slip.runId.toString());
    this.assertDraft(run);
    return { slip, run };
  }

  /** Re-derive a slip's totals from its stored breakdown + adjustments (no attendance re-read). */
  private async saveWithTotals(slip: PayslipDocument, run: PayrollRunDocument): Promise<PayslipDocument> {
    const { bonusPaise: _b, manualDeductionPaise: _m, ...base } = slip.breakdown;
    const t = totalsFor(base, slip.adjustments);
    slip.breakdown = t.breakdown as never;
    slip.grossPaise = t.grossPaise;
    slip.deductionsPaise = t.deductionsPaise;
    slip.netPaise = t.netPaise;
    slip.markModified('breakdown');
    await slip.save();
    await this.refreshTotals(run);
    return slip;
  }

  private async refreshTotals(run: PayrollRunDocument): Promise<void> {
    const slips = await this.slips.find({ runId: run._id }).exec();
    run.totalNetPaise = slips.reduce((s, x) => s + x.netPaise, 0);
    run.employeeCount = slips.length;
    await run.save();
  }

  private async monthContext(month: string): Promise<MonthContext> {
    const [y, m] = month.split('-').map(Number);
    if (!y || !m) throw new BadRequestException({ code: ErrorCodes.VALIDATION_FAILED, message: `Invalid month: ${month}` });
    const start = new Date(Date.UTC(y, m - 1, 1));
    const endExclusive = new Date(Date.UTC(y, m, 1));
    const settings = await this.settings.get();
    const holidays = await this.holidays.holidayDateSet(start, endExclusive, { excludeOptional: true });
    return {
      month,
      start,
      endExclusive,
      startYmd: start.toISOString().slice(0, 10),
      endYmdExclusive: endExclusive.toISOString().slice(0, 10),
      today: todayIn(settings.timezone),
      weekendDays: settings.weekendDays ?? [0, 6],
      holidays,
      treatMissingAsAbsent: !!settings.treatMissingAttendanceAsAbsent,
    };
  }

  /** Everyone who can sign in (active, probation, on leave) is considered; see skip reasons. */
  private async computeRun(run: PayrollRunDocument): Promise<void> {
    const ctx = await this.monthContext(run.month);
    const people = await this.users.list(
      { status: { $in: [...SIGN_IN_STATUSES] }, role: { $ne: Role.CLIENT } },
      { limit: 5000, sort: { name: 1 } },
    );
    const kept: Types.ObjectId[] = [];
    const skipped: { userId: Types.ObjectId; name: string; reason: PayrollSkipReason }[] = [];
    for (const user of people) {
      const joinedOn = user.dateOfJoining ? user.dateOfJoining.toISOString().slice(0, 10) : undefined;
      if (joinedOn && joinedOn >= ctx.endYmdExclusive) {
        skipped.push({ userId: user._id, name: user.name, reason: PayrollSkipReason.NOT_JOINED });
        continue;
      }
      const terms = await this.compensation.effectiveFor(user.id, ctx.endExclusive);
      if (!terms) {
        skipped.push({ userId: user._id, name: user.name, reason: PayrollSkipReason.NO_COMPENSATION });
        continue;
      }
      if (terms.type === CompensationType.PROJECT_BASED) {
        skipped.push({ userId: user._id, name: user.name, reason: PayrollSkipReason.PROJECT_BASED });
        continue;
      }
      await this.computeSlip(run, user, terms, ctx, joinedOn);
      kept.push(user._id);
    }
    // People who are no longer eligible lose their draft payslip; everyone else keeps theirs (same id).
    await this.slips.deleteMany({ runId: run._id, userId: { $nin: kept } }).exec();
    run.skipped = skipped as never;
    run.computedAt = new Date();
    await this.refreshTotals(run);
  }

  private async computeSlip(
    run: PayrollRunDocument,
    user: UserDocument,
    terms: CompensationTerms,
    ctx: MonthContext,
    joinedOn: string | undefined,
  ): Promise<void> {
    const entries = await this.attendance.entriesFor(user.id, ctx.startYmd, ctx.endYmdExclusive);
    const att = summarizeAttendance({
      month: ctx.month,
      today: ctx.today,
      weekendDays: ctx.weekendDays,
      holidays: ctx.holidays,
      entries,
      treatMissingAsAbsent: ctx.treatMissingAsAbsent,
      joinedOn,
    });
    // Manual adjustments live on the payslip and survive every recompute.
    const existing = await this.slips.findOne({ runId: run._id, userId: user._id }).exec();
    const adjustments = existing?.adjustments ?? [];
    const t = totalsFor(
      {
        baseAmount: terms.baseAmount,
        hra: terms.hra,
        specialAllowance: terms.specialAllowance,
        lopDeduction: lopDeduction(terms.baseAmount, att.lopDays, att.workingDays),
        providentFundEmployee: terms.providentFundEmployee,
        professionalTax: terms.professionalTax,
        tdsMonthly: terms.tdsMonthly,
        lateDeduction: 0,
      },
      adjustments,
    );
    await this.slips
      .findOneAndUpdate(
        { runId: run._id, userId: user._id },
        {
          $set: {
            runId: run._id,
            month: run.month,
            userId: user._id,
            breakdown: t.breakdown,
            grossPaise: t.grossPaise,
            deductionsPaise: t.deductionsPaise,
            netPaise: t.netPaise,
            workingDays: att.workingDays,
            elapsedWorkingDays: att.elapsedWorkingDays,
            presentDays: att.presentDays,
            lopDays: att.lopDays,
            absentDays: att.absentDays,
            leaveDays: att.leaveDays,
            unmarkedDays: att.unmarkedDays,
            notJoinedDays: att.notJoinedDays,
            currency: terms.currency || 'INR',
            adjustments,
          },
        },
        { upsert: true, new: true },
      )
      .exec();
  }

  private async peopleById(ids: string[]): Promise<Map<string, UserDocument>> {
    const unique = [...new Set(ids)].filter((id) => Types.ObjectId.isValid(id));
    if (!unique.length) return new Map();
    // Include deleted people too (their name is still the right label on an old payslip).
    const docs = await this.userModel.find({ _id: { $in: unique.map((id) => new Types.ObjectId(id)) } }).exec();
    return new Map(docs.map((u) => [u.id as string, u]));
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

  /** Fanout PAYSLIP_GENERATED notifications (emailed) when a run is finalized. */
  private async fanoutFinalized(runId: string): Promise<void> {
    const slips = await this.slips.find({ runId: new Types.ObjectId(runId) }).exec();
    for (const s of slips) {
      this.events.emit(EVENT_NAMES.notification.create, {
        userId: s.userId.toString(),
        type: NotificationType.PAYSLIP_GENERATED,
        title: `Payslip ready for ${monthLabel(s.month)}`,
        body: `Net pay ${rupees(s.netPaise)}`,
        linkPath: `/earnings?tab=payslips`,
        data: { payslipId: s.id, month: s.month },
      });
      this.events.emit(EVENT_NAMES.payroll.payslipReady, { payslipId: s.id, userId: s.userId.toString() });
    }
  }
}
