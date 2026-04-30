// CompensationHistory — append-only audit log of all comp changes per user.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

import { CompensationType } from '@agency/shared';

@Schema({ timestamps: true, collection: 'compensation_history' })
export class CompensationHistory {
  @Prop({ type: MS.Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;
  @Prop({ type: String, enum: Object.values(CompensationType), required: true })
  type!: CompensationType;
  @Prop({ type: Number, required: true }) baseAmount!: number;
  @Prop({ default: 'INR' }) currency!: string;
  @Prop({ type: Number, default: 0 }) hra!: number;
  @Prop({ type: Number, default: 0 }) specialAllowance!: number;
  @Prop({ type: Number, default: 0 }) providentFundEmployee!: number;
  @Prop({ type: Number, default: 0 }) providentFundEmployer!: number;
  @Prop({ type: Number, default: 0 }) professionalTax!: number;
  @Prop({ type: Number, default: 0 }) tdsMonthly!: number;
  @Prop({ type: Date, required: true }) effectiveFrom!: Date;
  @Prop({ type: MS.Types.ObjectId, ref: 'User', required: true }) changedBy!: Types.ObjectId;
  @Prop() reason?: string;
}

export type CompensationHistoryDocument = HydratedDocument<CompensationHistory>;
export const CompensationHistorySchema = SchemaFactory.createForClass(CompensationHistory);
