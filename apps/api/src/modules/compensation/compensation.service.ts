// CompensationService — OWNER-only ops. History row is appended on every upsert.
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import type { UpsertCompensationInput } from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';

import {
  CompensationHistory,
  type CompensationHistoryDocument,
} from './schemas/compensation-history.schema';
import {
  CompensationProfile,
  type CompensationProfileDocument,
} from './schemas/compensation-profile.schema';

@Injectable()
export class CompensationService {
  constructor(
    @InjectModel(CompensationProfile.name)
    private readonly profile: Model<CompensationProfileDocument>,
    @InjectModel(CompensationHistory.name)
    private readonly history: Model<CompensationHistoryDocument>,
  ) {}

  byUserId(userId: string): Promise<CompensationProfileDocument | null> {
    if (!Types.ObjectId.isValid(userId)) return Promise.resolve(null);
    return this.profile.findOne({ userId }).exec();
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

  async upsert(
    userId: string,
    input: UpsertCompensationInput,
    actorId: string,
  ): Promise<CompensationProfileDocument> {
    const userOid = new Types.ObjectId(userId);
    const effectiveFrom = new Date(input.effectiveFrom);
    const profile = await this.profile.findOneAndUpdate(
      { userId: userOid },
      {
        userId: userOid,
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
        notes: input.reason,
      },
      { new: true, upsert: true },
    );
    await this.history.create({
      userId: userOid,
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
      changedBy: new Types.ObjectId(actorId),
      reason: input.reason,
    });
    return profile!;
  }
}
