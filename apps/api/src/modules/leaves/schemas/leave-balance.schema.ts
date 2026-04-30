// LeaveBalance — per-year per-user leave bucket. Decremented on approval, restored on cancel/reject.
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MS, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'leave_balances' })
export class LeaveBalance {
  @Prop({ type: MS.Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;
  @Prop({ required: true, index: true }) year!: number;
  @Prop({ type: Number, default: 0 }) annualEntitlement!: number;
  @Prop({ type: Number, default: 0 }) annualUsed!: number;
  @Prop({ type: Number, default: 0 }) sickEntitlement!: number;
  @Prop({ type: Number, default: 0 }) sickUsed!: number;
}

export type LeaveBalanceDocument = HydratedDocument<LeaveBalance>;
export const LeaveBalanceSchema = SchemaFactory.createForClass(LeaveBalance);
LeaveBalanceSchema.index({ userId: 1, year: 1 }, { unique: true });
