// CompensationService — OWNER-only ops.
//
// Every save appends a history row. The history is the source of truth for *when* a package applies:
//   • effectiveFrom today or earlier → the profile (the "current package") is updated straight away.
//   • effectiveFrom in the future     → only the history row is written; the current package stays
//     active until that date, when it is promoted (lazily, on the next read).
// Payroll asks for the package effective for a given month via `effectiveFor`.
import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { AuditAction, type UpsertCompensationInput } from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';
import { emitAudit } from '@/common/utils/audit.util';

import {
  CompensationHistory,
  type CompensationHistoryDocument,
} from './schemas/compensation-history.schema';
import {
  CompensationProfile,
  type CompensationProfileDocument,
} from './schemas/compensation-profile.schema';

/** The pay fields shared by the profile and its history rows. */
export interface CompensationTerms {
  type: CompensationProfile['type'];
  baseAmount: number;
  currency: string;
  hra: number;
  specialAllowance: number;
  providentFundEmployee: number;
  providentFundEmployer: number;
  professionalTax: number;
  tdsMonthly: number;
  effectiveFrom: Date;
}

const TERM_KEYS = [
  'type',
  'baseAmount',
  'currency',
  'hra',
  'specialAllowance',
  'providentFundEmployee',
  'providentFundEmployer',
  'professionalTax',
  'tdsMonthly',
  'effectiveFrom',
] as const;

const pickTerms = (src: CompensationTerms): CompensationTerms =>
  Object.fromEntries(TERM_KEYS.map((k) => [k, src[k]])) as unknown as CompensationTerms;

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;

@Injectable()
export class CompensationService {
  constructor(
    @InjectModel(CompensationProfile.name)
    private readonly profile: Model<CompensationProfileDocument>,
    @InjectModel(CompensationHistory.name)
    private readonly history: Model<CompensationHistoryDocument>,
    private readonly events: EventEmitter2,
  ) {}

  /** Current package. Promotes a scheduled change whose date has arrived. */
  async byUserId(userId: string): Promise<CompensationProfileDocument | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    const userOid = new Types.ObjectId(userId);
    const [current, due] = await Promise.all([
      this.profile.findOne({ userId: userOid }).exec(),
      this.history
        .findOne({ userId: userOid, effectiveFrom: { $lte: new Date() } })
        .sort({ effectiveFrom: -1, createdAt: -1 })
        .exec(),
    ]);
    if (!due) return current;
    if (current?.sourceHistoryId && String(current.sourceHistoryId) === String(due._id)) return current;
    return this.profile
      .findOneAndUpdate(
        { userId: userOid },
        { userId: userOid, ...pickTerms(due), notes: due.reason, sourceHistoryId: due._id },
        { new: true, upsert: true },
      )
      .exec();
  }

  async findOrThrow(userId: string): Promise<CompensationProfileDocument> {
    const doc = await this.byUserId(userId);
    if (!doc) {
      throw new NotFoundException({
        code: ErrorCodes.COMPENSATION_NOT_SET,
        message: 'No compensation profile set for this user',
      });
    }
    return doc;
  }

  historyFor(userId: string): Promise<CompensationHistoryDocument[]> {
    if (!Types.ObjectId.isValid(userId)) return Promise.resolve([]);
    return this.history.find({ userId }).sort({ effectiveFrom: -1, createdAt: -1 }).exec();
  }

  /**
   * The package that applies to a pay period ending (exclusive) at `periodEndExclusive`:
   * the latest history row with effectiveFrom before the period end. People whose profile was
   * created without any history (old data) fall back to their profile.
   */
  async effectiveFor(userId: string, periodEndExclusive: Date): Promise<CompensationTerms | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    const userOid = new Types.ObjectId(userId);
    const row = await this.history
      .findOne({ userId: userOid, effectiveFrom: { $lt: periodEndExclusive } })
      .sort({ effectiveFrom: -1, createdAt: -1 })
      .exec();
    if (row) return pickTerms(row);
    const anyHistory = await this.history.exists({ userId: userOid });
    if (anyHistory) return null; // only future-dated packages → nothing applies yet
    const legacy = await this.profile.findOne({ userId: userOid }).exec();
    return legacy ? pickTerms(legacy) : null;
  }

  async upsert(
    userId: string,
    input: UpsertCompensationInput,
    actorId: string,
  ): Promise<CompensationProfileDocument | null> {
    const userOid = new Types.ObjectId(userId);
    const effectiveFrom = new Date(input.effectiveFrom);
    const terms: CompensationTerms = {
      type: input.type,
      baseAmount: input.baseAmount,
      currency: input.currency,
      hra: input.hra,
      specialAllowance: input.specialAllowance,
      providentFundEmployee: input.providentFundEmployee,
      providentFundEmployer: input.providentFundEmployer,
      professionalTax: input.professionalTax,
      tdsMonthly: input.tdsMonthly,
      effectiveFrom,
    };
    const before = await this.profile.findOne({ userId: userOid }).lean().exec();
    await this.history.create({
      userId: userOid,
      ...terms,
      changedBy: new Types.ObjectId(actorId),
      reason: input.reason,
    });
    const scheduled = effectiveFrom.getTime() > Date.now();
    // The current package is always "the latest row whose date has arrived" — same rule payroll uses.
    const profile = await this.byUserId(userId);
    const monthly = terms.baseAmount + terms.hra + terms.specialAllowance;
    emitAudit(this.events, {
      actorId,
      action: AuditAction.COMPENSATION_UPDATED,
      entity: 'user',
      entityId: userId,
      summary: `${scheduled ? 'Scheduled' : 'Set'} monthly pay ${rupees(monthly)} from ${effectiveFrom.toISOString().slice(0, 10)}`,
      before: before ? pickTerms(before as unknown as CompensationTerms) : undefined,
      after: { ...terms, effectiveFrom: effectiveFrom.toISOString().slice(0, 10), reason: input.reason, scheduled },
    });
    return profile;
  }
}
