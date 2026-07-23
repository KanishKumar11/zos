// Income schema — tracks non-client revenue (affiliate payouts, referrals, misc income).
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS } from 'mongoose';

export enum IncomeCategory {
  AFFILIATE = 'AFFILIATE',
  REFERRAL = 'REFERRAL',
  INTEREST = 'INTEREST',
  REFUND = 'REFUND',
  OTHER = 'OTHER',
}

@Schema({ timestamps: true, collection: 'income' })
export class Income {
  @Prop({ required: true }) title!: string;
  @Prop() description?: string;
  @Prop({ required: true, type: Number }) amountPaise!: number;
  @Prop({ required: true, enum: Object.values(IncomeCategory), default: IncomeCategory.OTHER })
  category!: IncomeCategory;
  @Prop({ required: true, type: Date }) date!: Date;
  @Prop() source?: string;
  @Prop() receiptRef?: string;
  @Prop({ default: 'INR' }) currency!: string;
  @Prop({ type: MS.Types.ObjectId, ref: 'User' }) addedBy?: MS.Types.ObjectId;
  @Prop({ type: Date }) deletedAt?: Date;
}

export type IncomeDocument = HydratedDocument<Income>;
export const IncomeSchema = SchemaFactory.createForClass(Income);
IncomeSchema.index({ date: -1 });
IncomeSchema.index({ category: 1 });
