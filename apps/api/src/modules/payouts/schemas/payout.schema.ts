// Payout — one payment the agency made to a team member or freelancer, optionally for a project.
// This is the single source of truth for "what have we paid whom".
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

import { PayeeType, PayoutCategory, PayoutMethod } from '@agency/shared';

@Schema({ timestamps: true, collection: 'payouts' })
export class Payout {
  @Prop({ type: String, enum: Object.values(PayeeType), required: true }) payeeType!: PayeeType;
  @Prop({ type: MS.Types.ObjectId, ref: 'User' }) userId?: Types.ObjectId;
  @Prop({ type: MS.Types.ObjectId, ref: 'Freelancer' }) freelancerId?: Types.ObjectId;
  @Prop({ type: MS.Types.ObjectId, ref: 'Project' }) projectId?: Types.ObjectId;
  @Prop({ type: Number, required: true }) amountPaise!: number;
  @Prop({ default: 'INR' }) currency!: string;
  @Prop({ type: Date, required: true }) paidAt!: Date;
  @Prop({ type: String, enum: Object.values(PayoutMethod), default: PayoutMethod.BANK }) method!: PayoutMethod;
  @Prop({ default: '' }) reference!: string;
  @Prop({ type: String, enum: Object.values(PayoutCategory), default: PayoutCategory.PROJECT_FEE })
  category!: PayoutCategory;
  @Prop({ default: '' }) note!: string;
  @Prop({ type: MS.Types.ObjectId, ref: 'User' }) createdBy?: Types.ObjectId;
  /** Set by the one-time import from the old embedded/freelancer payment records (idempotency key). */
  @Prop() legacyId?: string;
  @Prop({ type: Date }) deletedAt?: Date;
}

export type PayoutDocument = HydratedDocument<Payout>;
export const PayoutSchema = SchemaFactory.createForClass(Payout);
PayoutSchema.index({ projectId: 1, paidAt: -1 });
PayoutSchema.index({ userId: 1, paidAt: -1 });
PayoutSchema.index({ freelancerId: 1, paidAt: -1 });
PayoutSchema.index({ paidAt: -1 });
PayoutSchema.index({ legacyId: 1 }, { unique: true, sparse: true });
