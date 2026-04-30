// CompensationProfile — current compensation for a user. History is a separate collection.
// All fields here are OWNER-only and stripped from non-OWNER responses.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

import { CompensationType } from '@agency/shared';

@Schema({ timestamps: true, collection: 'compensation_profiles' })
export class CompensationProfile {
  @Prop({ type: MS.Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(CompensationType), required: true })
  type!: CompensationType;

  /** Stored in paise. Meaning depends on `type`:
   *   FIXED_MONTHLY → monthly gross
   *   STIPEND       → monthly stipend
   *   PROJECT_BASED → not used (per-project amounts captured on assignments)
   */
  @Prop({ type: Number, default: 0 }) baseAmount!: number;
  @Prop({ default: 'INR' }) currency!: string;

  @Prop({ type: Number, default: 0 }) hra!: number;
  @Prop({ type: Number, default: 0 }) specialAllowance!: number;
  @Prop({ type: Number, default: 0 }) providentFundEmployee!: number;
  @Prop({ type: Number, default: 0 }) providentFundEmployer!: number;
  @Prop({ type: Number, default: 0 }) professionalTax!: number;
  @Prop({ type: Number, default: 0 }) tdsMonthly!: number;

  @Prop({ type: Date, required: true }) effectiveFrom!: Date;
  @Prop() notes?: string;
}

export type CompensationProfileDocument = HydratedDocument<CompensationProfile>;
export const CompensationProfileSchema = SchemaFactory.createForClass(CompensationProfile);
